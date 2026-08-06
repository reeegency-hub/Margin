import { createHash } from "node:crypto";
import { z } from "zod";
import type { PosCanonicalLine, PosCanonicalSale } from "./types";

export const posCanonicalLineSchema = z.object({
  externalSku: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  quantity: z.number().finite().positive(),
  unitPrice: z.number().finite().nonnegative().optional(),
  soldAt: z.coerce.date().optional(),
  externalOrderId: z.string().trim().min(1).optional(),
});

export const posCanonicalSaleSchema = z
  .object({
    externalOrderId: z.string().trim().min(1).optional(),
    soldAt: z.coerce.date().optional(),
    lines: z.array(posCanonicalLineSchema).default([]),
    samplePayload: z.string().optional(),
    eventKind: z.enum(["SALE", "CANCEL"]).default("SALE"),
  })
  .superRefine((data, ctx) => {
    if (data.eventKind === "SALE" && data.lines.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Aucune ligne produit",
        path: ["lines"],
      });
    }
    if (data.eventKind === "CANCEL" && !data.externalOrderId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "externalOrderId requis pour CANCEL",
        path: ["externalOrderId"],
      });
    }
  });

export type ValidatedPosSale = z.infer<typeof posCanonicalSaleSchema>;

export function validateCanonicalSale(sale: PosCanonicalSale): {
  ok: true;
  data: ValidatedPosSale;
} | {
  ok: false;
  error: string;
} {
  const parsed = posCanonicalSaleSchema.safeParse({
    ...sale,
    eventKind: sale.eventKind ?? "SALE",
  });
  if (!parsed.success) {
    const msg = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "sale"}: ${i.message}`)
      .join("; ");
    return { ok: false, error: `SCHEMA: ${msg}` };
  }
  return { ok: true, data: parsed.data };
}

export function hashPayload(body: unknown): string {
  const raw =
    typeof body === "string" ? body : JSON.stringify(body ?? null);
  return createHash("sha256").update(raw).digest("hex");
}

/** Hash stable pour dédup quand le POS n’envoie pas d’ID. */
export function hashSaleFingerprint(opts: {
  connectionId: string;
  lines: PosCanonicalLine[];
  occurredAt?: Date | null;
  externalOrderId?: string | null;
}): string {
  const occurred =
    opts.occurredAt?.toISOString().slice(0, 16) ?? // minute
    "no-time";
  const linesKey = opts.lines
    .map((l) =>
      [
        (l.externalSku || "").toLowerCase(),
        l.name.trim().toLowerCase(),
        String(Math.round(l.quantity * 1000) / 1000),
        String(l.unitPrice ?? ""),
      ].join(":")
    )
    .sort()
    .join("|");
  const basis = [
    opts.connectionId,
    opts.externalOrderId || "",
    occurred,
    linesKey,
  ].join("::");
  return `h_${createHash("sha256").update(basis).digest("hex").slice(0, 32)}`;
}

export const POS_RETRY_MAX_ATTEMPTS = 8;
export const POS_ORDER_SKEW_MS = 2 * 60 * 1000;
/** Délai avant re-essai d’un CANCEL en attente de sa SALE. */
export const POS_DEFER_RETRY_MS = 45 * 1000;
export const POS_CANCEL_MAX_DEFER_ATTEMPTS = 12;

export function nextRetryAt(attempts: number): Date {
  const seconds = Math.min(3600, 30 * Math.pow(2, Math.max(0, attempts)));
  return new Date(Date.now() + seconds * 1000);
}
