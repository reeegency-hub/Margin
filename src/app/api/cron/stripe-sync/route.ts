import { NextResponse } from "next/server";
import { processPendingStripeWebhookEvents } from "@/lib/stripe/ingest";
import { runStripeReconciliation } from "@/lib/stripe/recon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Cron billing Stripe — retry events FAILED + réconciliation + fin de grâce.
 * Auth: Bearer $CRON_SECRET
 * Schedule: quotidien 06:00 (+ optionnel horaire retry)
 */
export async function GET(request: Request) {
  const { assertCronAuthorized } = await import("@/lib/cron-auth");
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const skipRecon = url.searchParams.get("skipRecon") === "1";
  const retry = await processPendingStripeWebhookEvents(40);
  const recon = skipRecon
    ? { checked: 0, mismatches: 0, fixed: 0, graceSuspended: 0, skipped: true }
    : await runStripeReconciliation();

  return NextResponse.json({ ok: true, retry, recon });
}

export async function POST(request: Request) {
  return GET(request);
}
