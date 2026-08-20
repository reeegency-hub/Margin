/**
 * Rate limit — mémoire process + Upstash Redis optionnel
 * (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

function memoryLimit(
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

/** Sync — mémoire seule (tests / fallback). */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  return memoryLimit(key, limit, windowMs);
}

async function upstashLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  const base = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!base || !token) return null;

  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `rl:${key}`;

  try {
    const res = await fetch(`${base}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, ttlSec],
      ]),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: unknown }[];
    const count = Number(data?.[0]?.result ?? 0);
    if (!Number.isFinite(count) || count <= 0) return null;
    if (count > limit) {
      return { ok: false, retryAfterSec: ttlSec };
    }
    return { ok: true, remaining: Math.max(0, limit - count) };
  } catch {
    return null;
  }
}

/** Async — Upstash si configuré, sinon mémoire. */
export async function checkRateLimitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const remote = await upstashLimit(key, limit, windowMs);
  if (remote) return remote;
  return memoryLimit(key, limit, windowMs);
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
