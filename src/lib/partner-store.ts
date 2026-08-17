import { prisma } from "@/lib/db";
import { createReferralForRestaurant } from "@/lib/crm/activity";

const DEFAULT_COMMISSION = 15;

export async function requirePartnerStore(ambassadorId: string, restaurantId: string) {
  const referral = await prisma.referral.findFirst({
    where: { ambassadorId, referredRestaurantId: restaurantId },
    include: {
      restaurant: {
        include: {
          users: { orderBy: { createdAt: "asc" }, take: 3 },
          externalPosConnections: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { products: true, stockUnits: true, employees: true } },
        },
      },
    },
  });
  if (!referral?.restaurant) return null;
  return referral;
}

export async function listPartnerStores(ambassadorId: string) {
  return prisma.referral.findMany({
    where: { ambassadorId, referredRestaurantId: { not: null } },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          stripeStatus: true,
          active: true,
          onboardingCompletedAt: true,
          whatsappTo: true,
          createdAt: true,
          users: { orderBy: { createdAt: "asc" }, take: 1, select: { email: true } },
          _count: { select: { products: true, stockUnits: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type CreatePartnerStoreInput = {
  ambassadorId: string;
  name: string;
  email: string;
  passwordHash: string;
  whatsapp?: string | null;
  skipOnboarding?: boolean;
  commissionPercent?: number;
};

export async function createPartnerStore(input: CreatePartnerStoreInput) {
  const restaurant = await prisma.restaurant.create({
    data: {
      name: input.name,
      timezone: "Europe/Paris",
      whatsappTo: input.whatsapp ?? null,
      plan: "commerce",
      billingPeriod: "monthly",
      stripeStatus: "none",
      active: true,
      onboardingCompletedAt: input.skipOnboarding ? new Date() : null,
      procurementMode: input.skipOnboarding ? "mixed" : null,
    },
  });

  await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      restaurantId: restaurant.id,
    },
  });

  for (const platform of ["uber_eats", "deliveroo", "just_eat", "other"]) {
    await prisma.deliveryPlatformConnection.create({
      data: {
        restaurantId: restaurant.id,
        platform,
        status: "DISCONNECTED",
        webhookSecret: `whsec_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
      },
    });
  }

  await createReferralForRestaurant({
    ambassadorId: input.ambassadorId,
    restaurantId: restaurant.id,
    commissionPercent: input.commissionPercent ?? DEFAULT_COMMISSION,
    status: input.skipOnboarding ? "onboarding" : "signed_up",
  });

  return restaurant;
}
