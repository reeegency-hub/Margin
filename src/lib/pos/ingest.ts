/**
 * Ingest POS — idempotent via PosWebhookEvent.
 */
import { prisma } from "@/lib/db";
import { recordSale } from "@/lib/stock-engine";
import { getPosAdapter } from "@/lib/pos/adapters";
import {
  normalizePosName,
  posDedupeKey,
} from "@/lib/pos/helpers";
import type { PosCanonicalLine, PosCanonicalSale } from "@/lib/pos/types";
import { resolveExternalEventId } from "@/lib/pos/event-id";
import {
  POS_RETRY_MAX_ATTEMPTS,
  hashPayload,
  hashSaleFingerprint,
  nextRetryAt,
  validateCanonicalSale,
} from "@/lib/pos/schema";
import { notifyPosOpsAlert } from "@/lib/pos/ops-alert";

export type IngestPosResult = {
  recorded: number;
  pending: number;
  unmatchedNames: string[];
  unmatchedSkus?: string[];
  externalOrderId?: string;
  duplicate?: boolean;
  deferred?: boolean;
  eventId?: string;
  saleId?: string;
  status?: string;
  error?: string;
};

async function upsertPendingProduct(opts: {
  restaurantId: string;
  connectionId?: string | null;
  line: PosCanonicalLine;
  samplePayload?: string;
}) {
  const { restaurantId, connectionId, line, samplePayload } = opts;
  const name = line.name.trim();
  if (!name) return;
  const dedupeKey = posDedupeKey(line);
  const normalizedName = normalizePosName(name);
  const qty = Math.max(0, line.quantity || 0);

  const existing = await prisma.posPendingProduct.findUnique({
    where: {
      restaurantId_dedupeKey: { restaurantId, dedupeKey },
    },
  });

  if (existing) {
      if (existing.status === "ACCEPTED") return;
    await prisma.posPendingProduct.updateMany({
      where: { id: existing.id, restaurantId },
      data: {
        timesSeen: existing.timesSeen + 1,
        totalQtySold: existing.totalQtySold + qty,
        lastUnitPrice: line.unitPrice ?? existing.lastUnitPrice,
        name,
        normalizedName,
        externalSku: line.externalSku?.trim() || existing.externalSku,
        connectionId: connectionId ?? existing.connectionId,
        status: "PENDING",
        samplePayload: samplePayload ?? existing.samplePayload,
      },
    });
    return;
  }

  await prisma.posPendingProduct.create({
    data: {
      restaurantId,
      connectionId: connectionId ?? null,
      dedupeKey,
      externalSku: line.externalSku?.trim() || null,
      name,
      normalizedName,
      lastUnitPrice: line.unitPrice ?? null,
      timesSeen: 1,
      totalQtySold: qty,
      status: "PENDING",
      samplePayload: samplePayload ?? null,
    },
  });
}

function matchDish(
  dishes: { id: string; name: string; externalSku: string | null }[],
  line: PosCanonicalLine
) {
  const sku = line.externalSku?.trim();
  if (sku) {
    const bySku = dishes.find(
      (d) => d.externalSku && d.externalSku.toLowerCase() === sku.toLowerCase()
    );
    if (bySku) return bySku;
  }
  const name = normalizePosName(line.name);
  return dishes.find((d) => normalizePosName(d.name) === name);
}

/**
 * Ingest a canonical POS sale: record matched lines, queue unknown products.
 */
export async function ingestPosSale(opts: {
  restaurantId: string;
  connectionId?: string | null;
  vendor: string;
  sale: PosCanonicalSale;
  /** When true (CSV bootstrap), skip recordSale — only discover catalog */
  discoverOnly?: boolean;
}): Promise<IngestPosResult> {
  const { restaurantId, connectionId, sale, discoverOnly } = opts;
  const lines = sale.lines.filter((l) => l.name?.trim());
  if (!lines.length) {
    return { recorded: 0, pending: 0, unmatchedNames: [] };
  }

  const dishes = await prisma.dish.findMany({
    where: { restaurantId, active: true },
    select: { id: true, name: true, externalSku: true },
  });

  const saleLines: { dishId: string; quantity: number }[] = [];
  const unmatched: PosCanonicalLine[] = [];
  const unmatchedNames: string[] = [];

  for (const line of lines) {
    const dish = matchDish(dishes, line);
    if (dish) {
      saleLines.push({
        dishId: dish.id,
        quantity: Math.max(1, Math.round(line.quantity) || 1),
      });
    } else {
      unmatched.push(line);
      unmatchedNames.push(line.name);
    }
  }

  let recorded = 0;
  let saleId: string | undefined;
  const externalOrderId =
    sale.externalOrderId?.trim() || `POS-${Date.now()}`;

  if (!discoverOnly && saleLines.length) {
    try {
      const created = await recordSale(restaurantId, saleLines, {
      channel: "pos_external",
        externalOrderId,
        soldAt: sale.soldAt ?? null,
    });
    recorded = saleLines.length;
      saleId = created.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Unique Sale.externalOrderId → déjà appliqué
      if (/unique|Unique|constraint/i.test(msg)) {
        return {
          recorded: 0,
          pending: unmatched.length,
          unmatchedNames,
          externalOrderId,
          duplicate: true,
          status: "IGNORED_DUP",
        };
      }
      throw err;
    }
  }

  for (const line of unmatched) {
    await upsertPendingProduct({
      restaurantId,
      connectionId,
      line,
      samplePayload: sale.samplePayload,
    });
  }

  if (connectionId && (recorded > 0 || unmatched.length)) {
    await prisma.externalPosConnection.updateMany({
      where: { id: connectionId, restaurantId },
      data: {
        lastOrderAt: new Date(),
        status: "CONNECTED",
        ...(sale.soldAt
          ? { lastAppliedOccurredAt: sale.soldAt }
          : {}),
      },
    });
  }

  return {
    recorded,
    pending: unmatched.length,
    unmatchedNames,
    externalOrderId,
    status: "APPLIED",
    saleId,
  };
}

async function applyEventFromPayload(opts: {
  eventId: string;
  restaurantId: string;
  connectionId: string;
  vendor: string;
  body: unknown;
}): Promise<IngestPosResult> {
  const adapter = getPosAdapter(opts.vendor);
  const rawSale = adapter.normalizeWebhook(opts.body);
  const validated = validateCanonicalSale(rawSale);
  if (!validated.ok) {
    await markEventFailed(opts.eventId, opts.restaurantId, validated.error, true);
    await notifyPosOpsAlert({
      level: "schema",
      restaurantId: opts.restaurantId,
      connectionId: opts.connectionId,
      message: validated.error,
    });
    return {
      recorded: 0,
      pending: 0,
      unmatchedNames: [],
      error: validated.error,
      status: "FAILED",
      eventId: opts.eventId,
    };
  }

  const sale: PosCanonicalSale = {
    externalOrderId: validated.data.externalOrderId,
    soldAt: validated.data.soldAt,
    lines: validated.data.lines,
    samplePayload: validated.data.samplePayload ?? rawSale.samplePayload,
  };

  // Order-gate soft réservé CANCEL / V2 — les ventes tardives s’appliquent toujours.

  await prisma.posWebhookEvent.updateMany({
    where: { id: opts.eventId, restaurantId: opts.restaurantId },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
    },
  });

  try {
    const result = await ingestPosSale({
      restaurantId: opts.restaurantId,
      connectionId: opts.connectionId,
      vendor: opts.vendor,
      sale,
    });

    if (result.duplicate) {
      await prisma.posWebhookEvent.updateMany({
        where: { id: opts.eventId, restaurantId: opts.restaurantId },
        data: {
          status: "IGNORED_DUP",
          appliedAt: new Date(),
          lastError: null,
          nextRetryAt: null,
        },
      });
      return { ...result, eventId: opts.eventId };
    }

    if (result.recorded === 0 && result.pending === 0) {
      await markEventFailed(
        opts.eventId,
        opts.restaurantId,
        "SCHEMA: aucune ligne exploitable après matching",
        false
      );
      return {
        ...result,
        error: "No items",
        status: "FAILED",
        eventId: opts.eventId,
      };
    }

    await prisma.posWebhookEvent.updateMany({
      where: { id: opts.eventId, restaurantId: opts.restaurantId },
      data: {
        status: "APPLIED",
        appliedAt: new Date(),
        recordedLines: result.recorded,
        pendingLines: result.pending,
        saleId: result.saleId ?? null,
        lastError: null,
        nextRetryAt: null,
      },
    });

    return { ...result, eventId: opts.eventId, status: "APPLIED" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markEventFailed(opts.eventId, opts.restaurantId, msg, false);
    return {
      recorded: 0,
      pending: 0,
      unmatchedNames: [],
      error: msg,
      status: "FAILED",
      eventId: opts.eventId,
    };
  }
}

async function markEventFailed(
  eventId: string,
  restaurantId: string,
  error: string,
  schemaHardFail: boolean
) {
  const event = await prisma.posWebhookEvent.findFirst({
    where: { id: eventId, restaurantId },
    select: { attempts: true },
  });
  const attempts = event?.attempts ?? 1;
  const dead = schemaHardFail || attempts >= POS_RETRY_MAX_ATTEMPTS;
  const errText = (
    (schemaHardFail ? "[schema] " : "") + error
  ).slice(0, 500);
  await prisma.posWebhookEvent.updateMany({
    where: { id: eventId, restaurantId },
    data: {
      status: dead ? "DEAD" : "FAILED",
      lastError: errText,
      nextRetryAt: dead ? null : nextRetryAt(attempts),
    },
  });
  if (dead) {
    await notifyPosOpsAlert({
      level: "dead",
      restaurantId,
      connectionId: "",
      message: errText.slice(0, 200),
      eventId,
    });
  }
}

/** Normalize raw webhook body with vendor adapter then ingest (idempotent). */
export async function ingestPosWebhook(opts: {
  restaurantId: string;
  connectionId: string;
  vendor: string;
  body: unknown;
  matchMode?: "sku_strict" | "sku_then_name";
}): Promise<IngestPosResult> {
  const adapter = getPosAdapter(opts.vendor);
  const rawSale = adapter.normalizeWebhook(opts.body);
  const payloadHash = hashPayload(opts.body);
  const externalEventId = resolveExternalEventId(
    adapter,
    opts.body,
    rawSale,
    opts.connectionId,
    hashSaleFingerprint
  );

  const rawPayload =
    typeof opts.body === "string"
      ? opts.body.slice(0, 8000)
      : JSON.stringify(opts.body).slice(0, 8000);

  try {
    const created = await prisma.posWebhookEvent.create({
      data: {
        restaurantId: opts.restaurantId,
        connectionId: opts.connectionId,
        vendor: opts.vendor,
        externalEventId,
        payloadHash,
        eventKind: "SALE",
        occurredAt: rawSale.soldAt ?? null,
        status: "RECEIVED",
        rawPayload,
      },
      select: { id: true },
    });

    return applyEventFromPayload({
      eventId: created.id,
      restaurantId: opts.restaurantId,
      connectionId: opts.connectionId,
      vendor: opts.vendor,
      body: opts.body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/unique|Unique|constraint/i.test(msg)) throw err;

    const existing = await prisma.posWebhookEvent.findUnique({
      where: {
        restaurantId_connectionId_externalEventId: {
          restaurantId: opts.restaurantId,
          connectionId: opts.connectionId,
          externalEventId,
        },
      },
    });

    if (!existing) throw err;

    if (existing.status === "APPLIED" || existing.status === "IGNORED_DUP") {
      return {
        recorded: existing.recordedLines,
        pending: existing.pendingLines,
        unmatchedNames: [],
        externalOrderId: rawSale.externalOrderId,
        duplicate: true,
        status: existing.status,
        eventId: existing.id,
      };
    }

    // Retry in-request for FAILED/RECEIVED/DEAD (manual) / PROCESSING stuck
    if (
      existing.status === "FAILED" ||
      existing.status === "RECEIVED" ||
      existing.status === "DEAD" ||
      existing.status === "PROCESSING"
    ) {
      let body: unknown = opts.body;
      if (existing.rawPayload) {
        try {
          body = JSON.parse(existing.rawPayload);
        } catch {
          body = opts.body;
        }
      }
      return applyEventFromPayload({
        eventId: existing.id,
    restaurantId: opts.restaurantId,
    connectionId: opts.connectionId,
    vendor: opts.vendor,
        body,
      });
    }

    return {
      recorded: 0,
      pending: 0,
      unmatchedNames: [],
      duplicate: true,
      status: existing.status,
      eventId: existing.id,
    };
  }
}

/** Cron / worker : retraiter FAILED / RECEIVED / DEAD (replay soft), par restaurant. */
export async function processPendingPosWebhookEvents(limit = 40): Promise<{
  processed: number;
  applied: number;
  failed: number;
  dead: number;
  replayedDead: number;
}> {
  const { withTenantRls } = await import("@/lib/db");
  const now = new Date();
  const deadCooldown = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true },
  });

  let processed = 0;
  let applied = 0;
  let failed = 0;
  let dead = 0;
  let replayedDead = 0;
  const remaining = () => Math.max(0, limit - processed);

  for (const restaurant of restaurants) {
    const take = remaining();
    if (take <= 0) break;

    await withTenantRls(restaurant.id, async (db) => {
      const due = await db.posWebhookEvent.findMany({
        where: {
          restaurantId: restaurant.id,
          status: { in: ["FAILED", "RECEIVED"] },
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          attempts: { lt: POS_RETRY_MAX_ATTEMPTS },
        },
        orderBy: { receivedAt: "asc" },
        take,
      });

      // DEAD soft (pas [schema]) : 1 replay après 6h, reset attempts
      const deadSlots = Math.min(3, remaining() - due.length);
      const deadDue =
        deadSlots > 0
          ? await db.posWebhookEvent.findMany({
              where: {
                restaurantId: restaurant.id,
                status: "DEAD",
                rawPayload: { not: null },
                updatedAt: { lte: deadCooldown },
                NOT: { lastError: { startsWith: "[schema]" } },
              },
              orderBy: { updatedAt: "asc" },
              take: deadSlots,
            })
          : [];

      for (const event of deadDue) {
        await db.posWebhookEvent.updateMany({
          where: { id: event.id, restaurantId: restaurant.id },
          data: {
            status: "FAILED",
            attempts: Math.max(0, POS_RETRY_MAX_ATTEMPTS - 2),
            nextRetryAt: null,
            lastError: `ops-replay: ${(event.lastError || "").slice(0, 400)}`,
          },
        });
        replayedDead += 1;
        due.push({ ...event, status: "FAILED" });
      }

      for (const event of due) {
        let body: unknown = {};
        if (event.rawPayload) {
          try {
            body = JSON.parse(event.rawPayload);
          } catch {
            body = {};
          }
        }
        const result = await applyEventFromPayload({
          eventId: event.id,
          restaurantId: event.restaurantId,
          connectionId: event.connectionId,
          vendor: event.vendor,
          body,
        });
        processed += 1;
        if (result.status === "APPLIED" || result.duplicate) applied += 1;
        else if (result.status === "DEAD") dead += 1;
        else failed += 1;
      }
    });
  }

  return { processed, applied, failed, dead, replayedDead };
}

/**
 * Bootstrap from import lines: aggregate unknowns into pending products.
 */
export async function ingestPosImportLines(opts: {
  restaurantId: string;
  connectionId?: string | null;
  vendor: string;
  lines: PosCanonicalLine[];
  recordSales?: boolean;
}): Promise<IngestPosResult> {
  return ingestPosSale({
    restaurantId: opts.restaurantId,
    connectionId: opts.connectionId,
    vendor: opts.vendor,
    sale: {
      lines: opts.lines,
      samplePayload: `import:${opts.vendor}:${opts.lines.length}`,
    },
    discoverOnly: !opts.recordSales,
  });
}
