/**
 * Rate limit mémoire (process). Suffisant en single-instance / cold starts ;
 * en multi-région Vercel, couplez avec un store Redis plus tard.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const row = buckets.get(key);
  if (!row || now > row.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (row.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((row.resetAt - now) / 1000)),
    };
  }
  row.count += 1;
  return { ok: true, remaining: limit - row.count };
}

/** IP depuis headers Next (Vercel / proxy). */
export async function clientIpFromHeaders(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const xf = h.get("x-forwarded-for") || "";
    const real = h.get("x-real-ip") || "";
    const ip = (xf.split(",")[0] || real || "unknown").trim();
    return ip.slice(0, 64) || "unknown";
  } catch {
    return "unknown";
  }
}

/** Signup : 5 essais / heure / IP, 3 / heure / email. */
export const SIGNUP_IP_LIMIT = 5;
export const SIGNUP_EMAIL_LIMIT = 3;
export const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

/** OTP signup : envois */
export const OTP_SEND_IP_LIMIT = 10;
export const OTP_SEND_EMAIL_LIMIT = 5;
export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;

/** Login credentials : anti-bruteforce */
export const LOGIN_IP_LIMIT = 30;
export const LOGIN_EMAIL_LIMIT = 15;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** Partner login */
export const PARTNER_LOGIN_IP_LIMIT = 20;
export const PARTNER_LOGIN_EMAIL_LIMIT = 10;
export const PARTNER_LOGIN_WINDOW_MS = 15 * 60 * 1000;
