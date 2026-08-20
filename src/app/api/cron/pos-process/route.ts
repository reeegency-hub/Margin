import { NextResponse } from "next/server";
import { processPendingPosWebhookEvents } from "@/lib/pos/ingest";
import { prisma } from "@/lib/db";
import { notifyPosOpsAlert } from "@/lib/pos/ops-alert";
import { assertCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cron POS — retry FAILED + digest DEAD récents.
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const result = await processPendingPosWebhookEvents(50);

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const deadRecent = await prisma.posWebhookEvent.count({
    where: { status: "DEAD", receivedAt: { gte: since } },
  });
  if (deadRecent >= 5) {
    await notifyPosOpsAlert({
      level: "dead",
      restaurantId: "*",
      connectionId: "",
      message: `${deadRecent} events DEAD dans la dernière heure`,
    });
  }

  const { getPosHealthSnapshot, notifyPosHealthAlerts } = await import(
    "@/lib/pos/health"
  );
  const health = await getPosHealthSnapshot(1);
  const healthAlerts = await notifyPosHealthAlerts(health);

  return NextResponse.json({
    ok: true,
    ...result,
    deadRecentHour: deadRecent,
    healthAlerts,
    health: {
      errorRatePct: health.rates.errorRatePct,
      latencyP95Ms: health.latencyMs.p95,
      backlog: health.backlog.pendingRetry,
      alerts: health.alerts,
    },
  });
}

export async function POST(request: Request) {
  return GET(request);
}
