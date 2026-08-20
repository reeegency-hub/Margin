import { NextResponse } from "next/server";

/**
 * Auth crons Vercel.
 * En production : CRON_SECRET obligatoire (sinon 503).
 * En dev : secret optionnel ; s’il est défini, il doit matcher.
 *
 * Bearer only — pas de ?secret= (fuite logs / Referer).
 */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (isProd && !secret) {
    console.error("[cron] CRON_SECRET manquant en production");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET required in production" },
      { status: 503 }
    );
  }

  if (secret && token !== secret) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null;
}
