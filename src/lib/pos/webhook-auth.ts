import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Auth webhooks caisse : secret partagé et/ou HMAC-SHA256.
 */
export function verifyPlainWebhookSecret(
  provided: string | null | undefined,
  expected: string
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Vérifie une signature HMAC-SHA256 du corps brut.
 * Formats acceptés :
 * - `sha256=<hex>`
 * - `v1=<hex>`
 * - hex brut
 */
export function verifyHmacSha256(opts: {
  rawBody: string;
  secret: string;
  signatureHeader: string | null | undefined;
}): boolean {
  const header = opts.signatureHeader?.trim();
  if (!header || !opts.secret) return false;

  const expectedHex = createHmac("sha256", opts.secret)
    .update(opts.rawBody, "utf8")
    .digest("hex");

  let provided = header;
  const m = header.match(/^(?:sha256|v1)=(.+)$/i);
  if (m) provided = m[1].trim();

  const a = Buffer.from(provided.toLowerCase());
  const b = Buffer.from(expectedHex.toLowerCase());
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type PosWebhookAuthResult =
  | { ok: true; method: "secret" | "hmac" }
  | { ok: false; status: 401 | 403; error: string };

export function authenticatePosWebhook(opts: {
  webhookSecret: string;
  rawBody: string;
  /** Header x-webhook-secret ou body.secret */
  plainSecret?: string | null;
  /** x-pos-signature | x-hub-signature-256 | x-margin-signature */
  signatureHeader?: string | null;
}): PosWebhookAuthResult {
  const sig =
    opts.signatureHeader?.trim() ||
    null;

  if (sig) {
    if (
      verifyHmacSha256({
        rawBody: opts.rawBody,
        secret: opts.webhookSecret,
        signatureHeader: sig,
      })
    ) {
      return { ok: true, method: "hmac" };
    }
    return { ok: false, status: 403, error: "Invalid HMAC signature" };
  }

  if (verifyPlainWebhookSecret(opts.plainSecret, opts.webhookSecret)) {
    return { ok: true, method: "secret" };
  }

  return { ok: false, status: 401, error: "Unauthorized" };
}

/** Alias provider URL → vendor interne */
export function resolvePosProvider(provider: string): string {
  const p = provider.trim().toLowerCase();
  if (p === "sumup" || p === "tiller-sumup") return "tiller";
  if (p === "l-addition" || p === "l_addition") return "laddition";
  return p;
}
