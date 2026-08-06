/**
 * Réconciliation POS nocturne (interne) + digest Ops.
 */
import { prisma } from "@/lib/db";
import { notifyPosOpsAlert } from "@/lib/pos/ops-alert";

function dayKeyFor(date: Date, timeZone = "Europe/Paris"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type ReconInternalResult = {
  restaurants: number;
  alerts: number;
  runs: number;
};

/**
 * Stats 24 h par magasin CONNECTED : events, stock négatif, pending stale.
 */
export async function runInternalPosReconciliation(opts?: {
  /** Jour couvert (défaut = hier) */
  forDate?: Date;
}): Promise<ReconInternalResult> {
  const target = opts?.forDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since = new Date(target.getTime());
  since.setHours(0, 0, 0, 0);
  const until = new Date(since.getTime() + 24 * 60 * 60 * 1000);
  const staleBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const restaurants = await prisma.restaurant.findMany({
    where: {
      active: true,
      externalPosConnections: { some: { status: "CONNECTED" } },
    },
    select: { id: true, name: true, timezone: true },
  });

  let alerts = 0;
  let runs = 0;

  for (const restaurant of restaurants) {
    const dayKey = dayKeyFor(since, restaurant.timezone || "Europe/Paris");

    const events = await prisma.posWebhookEvent.groupBy({
      by: ["status"],
      where: {
        restaurantId: restaurant.id,
        receivedAt: { gte: since, lt: until },
      },
      _count: { _all: true },
    });

    const counts = {
      applied: 0,
      failed: 0,
      dead: 0,
      deferred: 0,
    };
    for (const row of events) {
      const n = row._count._all;
      if (row.status === "APPLIED" || row.status === "IGNORED_DUP")
        counts.applied += n;
      else if (row.status === "FAILED") counts.failed += n;
      else if (row.status === "DEAD") counts.dead += n;
      else if (row.status === "DEFERRED") counts.deferred += n;
    }

    const negativeStock = await prisma.ingredient.count({
      where: {
        restaurantId: restaurant.id,
        stockTheoretical: { lt: 0 },
      },
    });

    const pendingStale = await prisma.posPendingProduct.count({
      where: {
        restaurantId: restaurant.id,
        status: "PENDING",
        createdAt: { lt: staleBefore },
      },
    });

    const problems: string[] = [];
    if (counts.dead > 0) problems.push(`${counts.dead} DEAD`);
    if (counts.failed >= 5) problems.push(`${counts.failed} FAILED`);
    if (counts.deferred >= 3) problems.push(`${counts.deferred} DEFERRED`);
    if (negativeStock > 0) problems.push(`${negativeStock} stock(s) négatif(s)`);
    if (pendingStale >= 5)
      problems.push(`${pendingStale} produits découverts > 7 j`);

    const status = problems.length ? "ALERT" : "OK";

    await prisma.posReconciliationRun.create({
      data: {
        restaurantId: restaurant.id,
        dayKey,
        kind: "internal",
        status,
        appliedCount: counts.applied,
        failedCount: counts.failed,
        deadCount: counts.dead,
        deferredCount: counts.deferred,
        pendingStale,
        negativeStock,
        detailJson: JSON.stringify({ problems, since: since.toISOString() }),
      },
    });
    runs += 1;

    if (problems.length) {
      alerts += 1;
      await notifyPosOpsAlert({
        level: "recon",
        restaurantId: restaurant.id,
        connectionId: "",
        message: `[${restaurant.name}] J ${dayKey}: ${problems.join(" · ")}`,
      });
    }
  }

  return { restaurants: restaurants.length, alerts, runs };
}
