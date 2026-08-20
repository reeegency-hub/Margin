import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { planFromStripePrice } from "@/lib/stripe";
import {
  computeGraceUntil,
  isPaidAccessStatus,
} from "@/lib/stripe/access";
import { notifyBillingDunning } from "@/lib/stripe/dunning";
import { notifyPosOpsAlert } from "@/lib/pos/ops-alert";

export type ChurnType = "voluntary" | "involuntary";

export async function applySubscriptionState(
  restaurantId: string,
  subscription: Stripe.Subscription,
  fallbackPlan?: string,
  fallbackPeriod?: string
) {
  const priceId = subscription.items.data[0]?.price?.id;
  const mapped = priceId ? planFromStripePrice(priceId) : null;
  const plan = mapped?.plan || fallbackPlan || "commerce";
  const billingPeriod = mapped?.billingPeriod || fallbackPeriod || "monthly";
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  const status = subscription.status;
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

  const existing = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      paymentFailedAt: true,
      accessGraceUntil: true,
      churnType: true,
      churnedAt: true,
    },
  });

  let active = isPaidAccessStatus(status);
  let paymentFailedAt = existing?.paymentFailedAt ?? null;
  let accessGraceUntil = existing?.accessGraceUntil ?? null;
  let churnType = existing?.churnType ?? null;
  let churnedAt = existing?.churnedAt ?? null;

  if (isPaidAccessStatus(status)) {
    paymentFailedAt = null;
    accessGraceUntil = null;
    // Réactivation après dunning : efface churn involontaire
    if (churnType === "involuntary") {
      churnType = null;
      churnedAt = null;
    }
    active = true;
  } else if (status === "past_due" || status === "unpaid") {
    if (!paymentFailedAt) paymentFailedAt = new Date();
    if (!accessGraceUntil) accessGraceUntil = computeGraceUntil(paymentFailedAt);
    // Grâce : accès maintenu
    active =
      accessGraceUntil.getTime() > Date.now() ? true : false;
    if (!active && !churnType) {
      churnType = "involuntary";
      churnedAt = new Date();
    }
  } else if (status === "canceled" || status === "incomplete_expired") {
    active = false;
    if (!churnType) {
      // cancel_at_period_end ou résiliation explicite → volontaire
      // sauf si on était déjà en past_due hors grâce
      const wasInvoluntary =
        existing?.paymentFailedAt &&
        existing.accessGraceUntil &&
        existing.accessGraceUntil.getTime() <= Date.now();
      churnType = wasInvoluntary ? "involuntary" : "voluntary";
      churnedAt = new Date();
    }
  } else if (status === "incomplete") {
    active = false;
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      plan,
      billingPeriod,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId || undefined,
      stripeStatus: status,
      cancelAtPeriodEnd,
      active,
      paymentFailedAt,
      accessGraceUntil,
      churnType,
      churnedAt,
    },
  });
}

export async function markSubscriptionDeleted(
  restaurantId: string,
  opts?: { voluntary?: boolean }
) {
  const existing = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      paymentFailedAt: true,
      accessGraceUntil: true,
      cancelAtPeriodEnd: true,
      stripeStatus: true,
      churnType: true,
    },
  });

  let churnType: ChurnType = "voluntary";
  if (opts?.voluntary === false) {
    churnType = "involuntary";
  } else if (
    existing?.stripeStatus === "past_due" ||
    existing?.stripeStatus === "unpaid" ||
    (existing?.accessGraceUntil &&
      existing.accessGraceUntil.getTime() <= Date.now() &&
      existing.paymentFailedAt)
  ) {
    churnType = "involuntary";
  } else if (existing?.cancelAtPeriodEnd) {
    churnType = "voluntary";
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      stripeStatus: "canceled",
      active: false,
      cancelAtPeriodEnd: false,
      churnType: existing?.churnType || churnType,
      churnedAt: new Date(),
    },
  });
}

export async function handleInvoicePaymentFailed(
  restaurantId: string,
  invoice: Stripe.Invoice
) {
  const now = new Date();
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      whatsappTo: true,
      paymentFailedAt: true,
      accessGraceUntil: true,
      dunningLastNotifiedAt: true,
      stripeCustomerId: true,
      users: { select: { email: true }, take: 1, orderBy: { createdAt: "asc" } },
    },
  });
  if (!restaurant) return;

  const paymentFailedAt = restaurant.paymentFailedAt ?? now;
  const accessGraceUntil =
    restaurant.accessGraceUntil ?? computeGraceUntil(paymentFailedAt);

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      stripeStatus: "past_due",
      paymentFailedAt,
      accessGraceUntil,
      // Grâce : ne pas couper immédiatement
      active: accessGraceUntil.getTime() > now.getTime(),
    },
  });

  const notified = await notifyBillingDunning({
    restaurant,
    invoice,
    accessGraceUntil,
    email: restaurant.users[0]?.email,
  });
  if (notified) {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { dunningLastNotifiedAt: now },
    });
  }

  await notifyPosOpsAlert({
    level: "recon",
    restaurantId,
    connectionId: "",
    message: `Paiement échoué — grâce jusqu’au ${accessGraceUntil.toISOString().slice(0, 10)}`,
  });
}

export async function handleInvoicePaymentSucceeded(
  restaurantId: string,
  opts?: {
    billingReason?: string | null;
    amountPaidCents?: number | null;
    stripeInvoiceId?: string | null;
  }
) {
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      stripeStatus: "active",
      active: true,
      paymentFailedAt: null,
      accessGraceUntil: null,
      dunningLastNotifiedAt: null,
      churnType: null,
      churnedAt: null,
      ...(opts?.amountPaidCents != null && opts.amountPaidCents > 0
        ? {
            lastInvoiceAmountCents: opts.amountPaidCents,
            lastInvoiceAt: new Date(),
          }
        : {}),
    },
  });

  const { syncReferralStatusForRestaurant, logActivity } = await import(
    "@/lib/crm/activity"
  );
  await syncReferralStatusForRestaurant(restaurantId);
  if (opts?.amountPaidCents != null && opts.amountPaidCents > 0) {
    const referral = await prisma.referral.findUnique({
      where: { referredRestaurantId: restaurantId },
      select: { ambassadorId: true, id: true },
    });
    await logActivity({
      kind: "invoice.paid",
      summary: `Facture payée (${(opts.amountPaidCents / 100).toFixed(2)} €)`,
      restaurantId,
      ambassadorId: referral?.ambassadorId ?? null,
      referralId: referral?.id ?? null,
      metadata: { amountPaidCents: opts.amountPaidCents },
    });

    if (opts.stripeInvoiceId) {
      const { createRewardEventForInvoice } = await import("@/lib/crm/rewards");
      await createRewardEventForInvoice({
        restaurantId,
        stripeInvoiceId: opts.stripeInvoiceId,
        invoiceAmountCents: opts.amountPaidCents,
      });
    }
  }

  // Affiliation magasin→magasin
  if (opts?.billingReason === "subscription_create") {
    const { AFFILIATE } = await import("@/lib/affiliate");
    const referee = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { referredByRestaurantId: true },
    });
    if (referee?.referredByRestaurantId) {
      await prisma.restaurant.update({
        where: { id: referee.referredByRestaurantId },
        data: {
          affiliateCreditMonths: {
            increment: AFFILIATE.rewardMonthsReferrer,
          },
        },
      });
    }
  }
}

export async function resolveRestaurantIdFromStripe(opts: {
  restaurantId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<string | null> {
  if (opts.restaurantId) {
    const r = await prisma.restaurant.findUnique({
      where: { id: opts.restaurantId },
      select: { id: true },
    });
    if (r) return r.id;
  }
  if (opts.subscriptionId) {
    const r = await prisma.restaurant.findFirst({
      where: { stripeSubscriptionId: opts.subscriptionId },
      select: { id: true },
    });
    if (r) return r.id;
  }
  if (opts.customerId) {
    const r = await prisma.restaurant.findFirst({
      where: { stripeCustomerId: opts.customerId },
      select: { id: true },
    });
    if (r) return r.id;
  }
  return null;
}
