/**
 * Réconciliation pull multi-caisse (J-1) : compare tickets vs Sale → backfill.
 */
import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/credentials";
import { ingestPosWebhook } from "@/lib/pos/ingest";
import { notifyPosOpsAlert } from "@/lib/pos/ops-alert";
import { getPosPullClient, vendorSupportsApiPull } from "@/lib/pos/pull";

function dayKeyFor(date: Date, timeZone = "Europe/Paris"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type PosPullReconResult = {
  connections: number;
  missing: number;
  extra: number;
  backfilled: number;
  errors: number;
};

const MISSING_ALERT_THRESHOLD = 3;
const CA_GAP_ALERT_RATIO = 0.05;

export async function runPosPullReconciliation(opts?: {
  forDate?: Date;
  backfill?: boolean;
  /** Limiter à un vendor (ex. zelty) */
  vendor?: string;
}): Promise<PosPullReconResult> {
  const backfill = opts?.backfill !== false;
  const target = opts?.forDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since = new Date(target);
  since.setHours(0, 0, 0, 0);
  const until = new Date(since.getTime() + 24 * 60 * 60 * 1000);

  const restaurants = await prisma.restaurant.findMany({
    where: {
      active: true,
      externalPosConnections: {
        some: {
          apiKeyEncrypted: { not: null },
          status: { in: ["CONNECTED", "PENDING"] },
          ...(opts?.vendor ? { vendor: opts.vendor } : {}),
        },
      },
    },
    select: { id: true, name: true, timezone: true },
  });

  let missingTotal = 0;
  let extraTotal = 0;
  let backfilled = 0;
  let errors = 0;
  let ran = 0;

  for (const restaurant of restaurants) {
    const connections = await prisma.externalPosConnection.findMany({
      where: {
        restaurantId: restaurant.id,
        apiKeyEncrypted: { not: null },
        status: { in: ["CONNECTED", "PENDING"] },
        ...(opts?.vendor ? { vendor: opts.vendor } : {}),
      },
    });

    for (const conn of connections) {
      if (!vendorSupportsApiPull(conn.vendor)) continue;
      const client = getPosPullClient(conn.vendor);
      if (!client) continue;

      const apiKey = decryptCredential(conn.apiKeyEncrypted);
      if (!apiKey) continue;
      ran += 1;

      const dayKey = dayKeyFor(
        since,
        restaurant.timezone || "Europe/Paris"
      );
      const kind = `${conn.vendor}_pull`;

      const pulled = await client.fetchOrders({
        apiKey,
        from: since,
        to: until,
        merchantExternalId: conn.merchantExternalId,
        apiBaseUrl: conn.apiBaseUrl,
      });

      if (!pulled.ok) {
        errors += 1;
        await prisma.posReconciliationRun.create({
          data: {
            restaurantId: restaurant.id,
            connectionId: conn.id,
            dayKey,
            kind,
            status: "ERROR",
            detailJson: JSON.stringify({ error: pulled.error, vendor: conn.vendor }),
          },
        });
        await notifyPosOpsAlert({
          level: "recon",
          restaurantId: restaurant.id,
          connectionId: conn.id,
          message: `Pull ${conn.vendor} échoué: ${pulled.error}`.slice(0, 200),
        });
        continue;
      }

      const posIds = new Set(
        pulled.orders
          .filter((o) => {
            const st = (o.status || "").toLowerCase();
            return !/cancel|void|refund|annul/.test(st);
          })
          .map((o) => o.id)
      );

      const sales = await prisma.sale.findMany({
        where: {
          restaurantId: restaurant.id,
          channel: { in: ["pos_external", "pos_cancelled"] },
          soldAt: { gte: since, lt: until },
          externalOrderId: { not: null },
        },
        select: { externalOrderId: true, totalAmount: true, channel: true },
      });

      const marginIds = new Set(
        sales
          .map((s) => s.externalOrderId)
          .filter((id): id is string => Boolean(id))
      );

      const missing = [...posIds].filter((id) => !marginIds.has(id));
      const extra = [...marginIds].filter((id) => !posIds.has(id));

      missingTotal += missing.length;
      extraTotal += extra.length;

      let backfilledHere = 0;
      if (backfill) {
        for (const id of missing.slice(0, 50)) {
          const order = pulled.orders.find((o) => o.id === id);
          if (!order) continue;
          try {
            const result = await ingestPosWebhook({
              restaurantId: restaurant.id,
              connectionId: conn.id,
              vendor: conn.vendor,
              body: client.toWebhookBody(order),
            });
            if (result.recorded > 0 || result.pending > 0 || result.duplicate) {
              backfilledHere += 1;
            }
          } catch {
            // continue
          }
        }
        backfilled += backfilledHere;
      }

      const posCa = pulled.orders.reduce((s, o) => s + (o.total ?? 0), 0);
      const marginCa = sales
        .filter((s) => s.channel !== "pos_cancelled")
        .reduce((s, row) => s + row.totalAmount, 0);
      const caGap =
        posCa > 0 ? Math.abs(posCa - marginCa) / posCa : marginCa > 0 ? 1 : 0;

      const problems: string[] = [];
      if (missing.length >= MISSING_ALERT_THRESHOLD) {
        problems.push(`${missing.length} tickets manquants`);
      }
      if (caGap > CA_GAP_ALERT_RATIO && (posCa > 0 || marginCa > 0)) {
        problems.push(
          `écart CA ${(caGap * 100).toFixed(1)} % (POS ${posCa.toFixed(0)} / Margin ${marginCa.toFixed(0)})`
        );
      }

      const status = problems.length ? "ALERT" : "OK";
      await prisma.posReconciliationRun.create({
        data: {
          restaurantId: restaurant.id,
          connectionId: conn.id,
          dayKey,
          kind,
          status,
          missingCount: missing.length,
          extraCount: extra.length,
          backfilledCount: backfilledHere,
          detailJson: JSON.stringify({
            vendor: conn.vendor,
            problems,
            missingSample: missing.slice(0, 20),
            extraSample: extra.slice(0, 20),
            posOrders: posIds.size,
            marginSales: marginIds.size,
            posCa,
            marginCa,
          }),
        },
      });

      if (problems.length) {
        await notifyPosOpsAlert({
          level: "recon",
          restaurantId: restaurant.id,
          connectionId: conn.id,
          message: `[${restaurant.name}] ${conn.vendor} pull ${dayKey}: ${problems.join(" · ")}`,
        });
      }
    }
  }

  return {
    connections: ran,
    missing: missingTotal,
    extra: extraTotal,
    backfilled,
    errors,
  };
}

/** Alias rétrocompat */
export const runZeltyPullReconciliation = (opts?: {
  forDate?: Date;
  backfill?: boolean;
}) => runPosPullReconciliation({ ...opts, vendor: "zelty" });
