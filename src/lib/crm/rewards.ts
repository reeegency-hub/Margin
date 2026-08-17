import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/crm/activity";

export type RewardStatus = "pending" | "validated" | "paid" | "reversed";

export const REWARD_STATUS_LABEL: Record<RewardStatus, string> = {
  pending: "En attente",
  validated: "Validée",
  paid: "Versée",
  reversed: "Annulée",
};

/** Crée un RewardEvent idempotent à chaque facture payée d'un filleul. */
export async function createRewardEventForInvoice(input: {
  restaurantId: string;
  stripeInvoiceId: string;
  invoiceAmountCents: number;
}) {
  if (input.invoiceAmountCents <= 0) return null;

  const referral = await prisma.referral.findUnique({
    where: { referredRestaurantId: input.restaurantId },
    include: { restaurant: { select: { name: true } } },
  });
  if (!referral) return null;

  const commissionCents = Math.round(
    (input.invoiceAmountCents * referral.commissionPercent) / 100
  );

  const existing = await prisma.rewardEvent.findUnique({
    where: { stripeInvoiceId: input.stripeInvoiceId },
  });
  if (existing) return existing;

  const event = await prisma.rewardEvent.create({
    data: {
      ambassadorId: referral.ambassadorId,
      referralId: referral.id,
      referredRestaurantId: input.restaurantId,
      stripeInvoiceId: input.stripeInvoiceId,
      invoiceAmountCents: input.invoiceAmountCents,
      commissionPercent: referral.commissionPercent,
      commissionCents,
      status: "validated",
    },
  });

  await logActivity({
    kind: "reward.earned",
    summary: `Commission ${(commissionCents / 100).toFixed(2)} € — ${referral.restaurant?.name ?? "magasin"}`,
    restaurantId: input.restaurantId,
    ambassadorId: referral.ambassadorId,
    referralId: referral.id,
    metadata: {
      rewardEventId: event.id,
      invoiceAmountCents: input.invoiceAmountCents,
      commissionCents,
    },
  });

  return event;
}

export async function getAmbassadorRewardSummary(ambassadorId: string) {
  const events = await prisma.rewardEvent.findMany({
    where: { ambassadorId },
    orderBy: { earnedAt: "desc" },
    include: {
      restaurant: { select: { id: true, name: true } },
    },
  });

  let validatedCents = 0;
  let paidCents = 0;
  let pendingCents = 0;

  for (const e of events) {
    if (e.status === "paid") paidCents += e.commissionCents;
    else if (e.status === "validated") validatedCents += e.commissionCents;
    else if (e.status === "pending") pendingCents += e.commissionCents;
  }

  return {
    events,
    totals: {
      earnedCents: validatedCents + paidCents + pendingCents,
      validatedCents,
      paidCents,
      pendingCents,
      count: events.length,
    },
  };
}

export async function getAmbassadorRewardTotalsByAmbassador(
  ambassadorIds: string[]
): Promise<Map<string, { earnedCents: number; paidCents: number; count: number }>> {
  if (!ambassadorIds.length) return new Map();

  const grouped = await prisma.rewardEvent.groupBy({
    by: ["ambassadorId", "status"],
    where: { ambassadorId: { in: ambassadorIds } },
    _sum: { commissionCents: true },
    _count: { _all: true },
  });

  const out = new Map<
    string,
    { earnedCents: number; paidCents: number; count: number }
  >();

  for (const id of ambassadorIds) {
    out.set(id, { earnedCents: 0, paidCents: 0, count: 0 });
  }

  for (const row of grouped) {
    const cur = out.get(row.ambassadorId)!;
    const cents = row._sum.commissionCents ?? 0;
    cur.count += row._count._all;
    if (row.status === "paid") cur.paidCents += cents;
    if (row.status !== "reversed") cur.earnedCents += cents;
  }

  return out;
}
