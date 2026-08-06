import { NextResponse } from "next/server";
import { runInternalPosReconciliation } from "@/lib/pos/recon";
import { runPosPullReconciliation } from "@/lib/pos/pull-recon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Cron réconciliation POS — interne + pull toutes caisses (si clé API).
 * Auth: Authorization: Bearer $CRON_SECRET
 * Schedule recommandé : 05:15
 */
export async function GET(request: Request) {
  const { assertCronAuthorized } = await import("@/lib/cron-auth");
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const skipPull = url.searchParams.get("skipPull") === "1";
  const vendor = url.searchParams.get("vendor") || undefined;

  const internal = await runInternalPosReconciliation();
  const pull = skipPull
    ? {
        connections: 0,
        missing: 0,
        extra: 0,
        backfilled: 0,
        errors: 0,
        skipped: true,
      }
    : await runPosPullReconciliation({ vendor });

  return NextResponse.json({ ok: true, internal, pull });
}

export async function POST(request: Request) {
  return GET(request);
}
