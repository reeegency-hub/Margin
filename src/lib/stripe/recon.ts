/**
 * Réconciliation Stripe ↔ Margin + application fin de grâce.
 */
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { applySubscriptionState } from "@/lib/stripe/apply";
import { notifyPosOpsAlert } from "@/lib/pos/ops-alert";
import { STRIPE_GRACE_DAYS } from "@/lib/stripe/access";

export async function runStripeReconciliation(): Promise<{
  checked: number;
  mismatches: number;
  fixed: number;
  graceSuspended: number;
}> {
  const stripe = getStripe();
  let checked = 0;
  let mismatches = 0;
  let fixed = 0;
  let graceSuspended = 0;
  const details: unknown[] = [];

  // 1. Fin de grâce → suspension + churn involontaire
  const now = new Date();
  const expired = await prisma.restaurant.findMany({
    where: {
      OR: [{ stripeStatus: "past_due" }, { stripeStatus: "unpaid" }],
      accessGraceUntil: { lte: now },
      active: true,
    },
    select: { id: true, name: true, stripeStatus: true },
  });

  for (const r of expired) {
    await prisma.restaurant.update({
      where: { id: r.id },
      data: {
        active: false,
        churnType: "involuntary",
        churnedAt: now,
      },
    });
    graceSuspended += 1;
    await notifyPosOpsAlert({
      level: "recon",
      restaurantId: r.id,
      connectionId: "",
      message: `Grâce ${STRIPE_GRACE_DAYS}j expirée — accès suspendu (churn involontaire)`,
    });
  }

  if (!stripe) {
    await prisma.stripeReconciliationRun.create({
      data: {
        status: graceSuspended ? "ALERT" : "SKIP",
        checkedCount: 0,
        mismatchCount: 0,
        fixedCount: 0,
        detailJson: JSON.stringify({
          reason: "Stripe non configuré",
          graceSuspended,
        }),
      },
    });
    return { checked, mismatches, fixed, graceSuspended };
  }

  const restaurants = await prisma.restaurant.findMany({
    where: {
      stripeSubscriptionId: { not: null },
    },
    select: {
      id: true,
      name: true,
      stripeSubscriptionId: true,
      stripeStatus: true,
      plan: true,
      billingPeriod: true,
      cancelAtPeriodEnd: true,
      active: true,
    },
    take: 300,
  });

  for (const r of restaurants) {
    if (!r.stripeSubscriptionId) continue;
    checked += 1;
    try {
      const sub = await stripe.subscriptions.retrieve(r.stripeSubscriptionId);
      const remoteStatus = sub.status;
      const remoteCancel = Boolean(sub.cancel_at_period_end);
      const drift =
        remoteStatus !== r.stripeStatus ||
        remoteCancel !== r.cancelAtPeriodEnd ||
        (isPaid(remoteStatus) && !r.active) ||
        (!isPaid(remoteStatus) &&
          remoteStatus !== "past_due" &&
          remoteStatus !== "unpaid" &&
          r.active &&
          remoteStatus === "canceled");

      if (drift) {
        mismatches += 1;
        await applySubscriptionState(r.id, sub);
        fixed += 1;
        details.push({
          restaurantId: r.id,
          local: r.stripeStatus,
          remote: remoteStatus,
        });
      }
    } catch (err) {
      mismatches += 1;
      details.push({
        restaurantId: r.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const status =
    mismatches > 0 || graceSuspended > 0 ? "ALERT" : "OK";

  await prisma.stripeReconciliationRun.create({
    data: {
      status,
      checkedCount: checked,
      mismatchCount: mismatches,
      fixedCount: fixed,
      detailJson: JSON.stringify({
        graceSuspended,
        details: details.slice(0, 40),
        graceDays: STRIPE_GRACE_DAYS,
      }),
    },
  });

  if (mismatches >= 3 || graceSuspended > 0) {
    await notifyPosOpsAlert({
      level: "recon",
      restaurantId: "*",
      connectionId: "",
      message: `Stripe recon: checked=${checked} mismatch=${mismatches} fixed=${fixed} graceOut=${graceSuspended}`,
    });
  }

  return { checked, mismatches, fixed, graceSuspended };
}

function isPaid(status: string) {
  return status === "active" || status === "trialing";
}

/** Stats churn pour Ops / business. */
export async function getChurnBreakdown(days = 30): Promise<{
  voluntary: number;
  involuntary: number;
  unknown: number;
  total: number;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.restaurant.groupBy({
    by: ["churnType"],
    where: {
      churnedAt: { gte: since },
      churnType: { not: null },
    },
    _count: { _all: true },
  });

  let voluntary = 0;
  let involuntary = 0;
  let unknown = 0;
  for (const row of rows) {
    const n = row._count._all;
    if (row.churnType === "voluntary") voluntary += n;
    else if (row.churnType === "involuntary") involuntary += n;
    else unknown += n;
  }

  // Aussi compter canceled sans churnType
  const orphan = await prisma.restaurant.count({
    where: {
      stripeStatus: "canceled",
      churnType: null,
      updatedAt: { gte: since },
      active: false,
    },
  });
  unknown += orphan;

  return {
    voluntary,
    involuntary,
    unknown,
    total: voluntary + involuntary + unknown,
  };
}
