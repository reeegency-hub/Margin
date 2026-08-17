import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type ActivityKind =
  | "referral.signed_up"
  | "referral.onboarding"
  | "referral.converted"
  | "referral.churned"
  | "store.created"
  | "invoice.paid"
  | "invoice.failed"
  | "admin.note";

export async function logActivity(input: {
  kind: ActivityKind | string;
  summary: string;
  restaurantId?: string | null;
  ambassadorId?: string | null;
  referralId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.activityLog.create({
    data: {
      kind: input.kind,
      summary: input.summary,
      restaurantId: input.restaurantId ?? null,
      ambassadorId: input.ambassadorId ?? null,
      referralId: input.referralId ?? null,
      metadata: input.metadata,
    },
  });
}

/** Statuts filleul : clicked → signed_up → onboarding → converted → churned */
export type ReferralStatus =
  | "clicked"
  | "signed_up"
  | "onboarding"
  | "converted"
  | "churned";

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  clicked: "Lien cliqué",
  signed_up: "Inscrit",
  onboarding: "Onboarding",
  converted: "Payant",
  churned: "Churné",
};

export async function deriveReferralStatus(restaurant: {
  onboardingCompletedAt: Date | null;
  stripeStatus: string | null;
  active: boolean;
  churnedAt: Date | null;
}): Promise<ReferralStatus> {
  if (restaurant.churnedAt || restaurant.stripeStatus === "canceled") {
    return "churned";
  }
  if (restaurant.stripeStatus === "active") {
    return "converted";
  }
  if (restaurant.onboardingCompletedAt) {
    return "onboarding";
  }
  return "signed_up";
}

export async function syncReferralStatusForRestaurant(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      onboardingCompletedAt: true,
      stripeStatus: true,
      active: true,
      churnedAt: true,
    },
  });
  if (!restaurant) return;

  const referral = await prisma.referral.findUnique({
    where: { referredRestaurantId: restaurantId },
  });
  if (!referral) return;

  const next = await deriveReferralStatus(restaurant);
  if (referral.status === next) return;

  const now = new Date();
  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: next,
      signedUpAt: referral.signedUpAt ?? now,
      convertedAt: next === "converted" ? now : referral.convertedAt,
      churnedAt: next === "churned" ? now : referral.churnedAt,
    },
  });

  await logActivity({
    kind: `referral.${next === "onboarding" ? "onboarding" : next}`,
    summary: `${restaurant.name} → ${REFERRAL_STATUS_LABEL[next]}`,
    restaurantId,
    ambassadorId: referral.ambassadorId,
    referralId: referral.id,
  });
}

export async function createReferralForRestaurant(input: {
  ambassadorId: string;
  restaurantId: string;
  commissionPercent?: number;
  status?: ReferralStatus;
}) {
  const referral = await prisma.referral.upsert({
    where: { referredRestaurantId: input.restaurantId },
    create: {
      ambassadorId: input.ambassadorId,
      referredRestaurantId: input.restaurantId,
      commissionPercent: input.commissionPercent ?? 15,
      status: input.status ?? "signed_up",
      signedUpAt: new Date(),
    },
    update: {
      ambassadorId: input.ambassadorId,
      commissionPercent: input.commissionPercent ?? 15,
    },
  });

  await logActivity({
    kind: "referral.signed_up",
    summary: "Magasin lié à l'ambassadeur",
    restaurantId: input.restaurantId,
    ambassadorId: input.ambassadorId,
    referralId: referral.id,
  });

  await syncReferralStatusForRestaurant(input.restaurantId);
  return referral;
}
