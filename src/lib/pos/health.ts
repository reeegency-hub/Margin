/**
 * Métriques santé sync caisse (observabilité Ops).
 */
import { prisma } from "@/lib/db";
import { notifyPosOpsAlert } from "@/lib/pos/ops-alert";

export type PosHealthSnapshot = {
  generatedAt: string;
  windowHours: number;
  totals: {
    received: number;
    applied: number;
    failed: number;
    dead: number;
    deferred: number;
    skuNotFound: number;
    dup: number;
  };
  rates: {
    errorRatePct: number;
    successRatePct: number;
  };
  latencyMs: {
    /** p95 appliedAt - receivedAt sur fenêtre (ms) ; null si < 5 samples */
    p95: number | null;
    sampleSize: number;
  };
  backlog: {
    pendingRetry: number;
  };
  alerts: { code: string; message: string; severity: "warn" | "crit" }[];
};

/** Seuils Ops (stade 60 clients). */
export const POS_HEALTH_THRESHOLDS = {
  errorRatePctWarn: 2,
  errorRatePctCrit: 5,
  latencyP95MsWarn: 3000,
  latencyP95MsCrit: 8000,
  deadLastHourCrit: 5,
  backlogWarn: 100,
  backlogCrit: 400,
} as const;

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1
  );
  return sorted[Math.max(0, idx)];
}

export async function getPosHealthSnapshot(
  windowHours = 24
): Promise<PosHealthSnapshot> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const now = new Date();

  const grouped = await prisma.posWebhookEvent.groupBy({
    by: ["status"],
    where: { receivedAt: { gte: since } },
    _count: { _all: true },
  });

  const totals = {
    received: 0,
    applied: 0,
    failed: 0,
    dead: 0,
    deferred: 0,
    skuNotFound: 0,
    dup: 0,
  };

  for (const row of grouped) {
    const n = row._count._all;
    totals.received += n;
    if (row.status === "APPLIED") totals.applied += n;
    else if (row.status === "FAILED") totals.failed += n;
    else if (row.status === "DEAD") totals.dead += n;
    else if (row.status === "DEFERRED") totals.deferred += n;
    else if (row.status === "SKU_NOT_FOUND") totals.skuNotFound += n;
    else if (row.status === "IGNORED_DUP") totals.dup += n;
  }

  const errorLike = totals.failed + totals.dead + totals.skuNotFound;
  const denom = Math.max(1, totals.received);
  const errorRatePct = Math.round((errorLike / denom) * 1000) / 10;
  const successRatePct =
    Math.round(((totals.applied + totals.dup) / denom) * 1000) / 10;

  const appliedSample = await prisma.posWebhookEvent.findMany({
    where: {
      status: { in: ["APPLIED", "SKU_NOT_FOUND"] },
      receivedAt: { gte: since },
      appliedAt: { not: null },
    },
    select: { receivedAt: true, appliedAt: true },
    orderBy: { receivedAt: "desc" },
    take: 500,
  });

  const lags = appliedSample
    .map((e) =>
      e.appliedAt ? e.appliedAt.getTime() - e.receivedAt.getTime() : 0
    )
    .filter((n) => n >= 0)
    .sort((a, b) => a - b);

  const pendingRetry = await prisma.posWebhookEvent.count({
    where: {
      status: { in: ["FAILED", "RECEIVED", "DEFERRED"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
  });

  const deadLastHour = await prisma.posWebhookEvent.count({
    where: {
      status: "DEAD",
      receivedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });

  const alerts: PosHealthSnapshot["alerts"] = [];
  const T = POS_HEALTH_THRESHOLDS;

  if (errorRatePct >= T.errorRatePctCrit) {
    alerts.push({
      code: "ERROR_RATE_CRIT",
      severity: "crit",
      message: `Taux d'erreur ${errorRatePct}% (≥ ${T.errorRatePctCrit}%) sur ${windowHours}h`,
    });
  } else if (errorRatePct >= T.errorRatePctWarn) {
    alerts.push({
      code: "ERROR_RATE_WARN",
      severity: "warn",
      message: `Taux d'erreur ${errorRatePct}% (≥ ${T.errorRatePctWarn}%) sur ${windowHours}h`,
    });
  }

  const p95 = lags.length >= 5 ? percentile(lags, 95) : null;
  if (p95 != null && p95 >= T.latencyP95MsCrit) {
    alerts.push({
      code: "LATENCY_CRIT",
      severity: "crit",
      message: `Latence p95 traitement ${p95}ms (≥ ${T.latencyP95MsCrit}ms)`,
    });
  } else if (p95 != null && p95 >= T.latencyP95MsWarn) {
    alerts.push({
      code: "LATENCY_WARN",
      severity: "warn",
      message: `Latence p95 traitement ${p95}ms (≥ ${T.latencyP95MsWarn}ms)`,
    });
  }

  if (deadLastHour >= T.deadLastHourCrit) {
    alerts.push({
      code: "DEAD_SPIKE",
      severity: "crit",
      message: `${deadLastHour} events DEAD / dernière heure (≥ ${T.deadLastHourCrit})`,
    });
  }

  if (pendingRetry >= T.backlogCrit) {
    alerts.push({
      code: "BACKLOG_CRIT",
      severity: "crit",
      message: `Backlog retry ${pendingRetry} (≥ ${T.backlogCrit}) — cron 50/min saturé`,
    });
  } else if (pendingRetry >= T.backlogWarn) {
    alerts.push({
      code: "BACKLOG_WARN",
      severity: "warn",
      message: `Backlog retry ${pendingRetry} (≥ ${T.backlogWarn})`,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    windowHours,
    totals,
    rates: { errorRatePct, successRatePct },
    latencyMs: { p95, sampleSize: lags.length },
    backlog: { pendingRetry },
    alerts,
  };
}

/** Envoie Slack pour alertes crit (dédup soft via message). */
export async function notifyPosHealthAlerts(
  snap: PosHealthSnapshot
): Promise<number> {
  const crits = snap.alerts.filter((a) => a.severity === "crit");
  for (const a of crits) {
    await notifyPosOpsAlert({
      level: "dead",
      restaurantId: "*",
      connectionId: "",
      message: `[HEALTH] ${a.code}: ${a.message}`,
    });
  }
  return crits.length;
}
