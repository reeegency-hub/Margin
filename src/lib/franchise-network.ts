import { prisma, type TenantDb } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";

function resolvePlan(plan: string | null | undefined) {
  const id = (plan || "commerce") as PlanId;
  return PLANS.find((p) => p.id === id) || PLANS[0];
}

/**
 * Crée (ou rattache) un FranchiseNetwork pour un restaurant HQ plan reseau.
 * Idempotent : si déjà en network, retourne l’existant.
 */
export async function ensureFranchiseNetwork(
  restaurantId: string,
  db: TenantDb = prisma
): Promise<{ networkId: string; created: boolean }> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      plan: true,
      networkId: true,
    },
  });
  if (!restaurant) {
    throw new Error("Restaurant introuvable");
  }

  if (restaurant.networkId) {
    return { networkId: restaurant.networkId, created: false };
  }

  const network = await db.franchiseNetwork.create({
    data: {
      name: `${restaurant.name} — Réseau`,
      hqRestaurantId: restaurant.id,
      restaurants: { connect: { id: restaurant.id } },
    },
  });

  // Rattache les users du HQ en membership OWNER si manquant
  const users = await db.user.findMany({
    where: { restaurantId },
    select: { id: true },
  });
  for (const u of users) {
    await db.userRestaurant.upsert({
      where: {
        userId_restaurantId: { userId: u.id, restaurantId },
      },
      create: {
        userId: u.id,
        restaurantId,
        role: "OWNER",
      },
      update: {},
    });
  }

  return { networkId: network.id, created: true };
}

/** Plan effectif du network = plan du HQ (billing). */
export async function getNetworkBillingPlan(
  networkId: string,
  db: TenantDb = prisma
): Promise<string | null> {
  const network = await db.franchiseNetwork.findUnique({
    where: { id: networkId },
    select: {
      hqRestaurant: { select: { plan: true } },
    },
  });
  return network?.hqRestaurant.plan ?? null;
}

export async function listNetworkStores(
  networkId: string,
  db: TenantDb = prisma
) {
  return db.restaurant.findMany({
    where: { networkId },
    select: {
      id: true,
      name: true,
      active: true,
      onboardingCompletedAt: true,
      whatsappTo: true,
      plan: true,
      stripeStatus: true,
      createdAt: true,
      _count: {
        select: {
          externalPosConnections: true,
          alerts: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function userCanAccessRestaurant(
  userId: string,
  restaurantId: string,
  db: TenantDb = prisma
): Promise<boolean> {
  const membership = await db.userRestaurant.findUnique({
    where: {
      userId_restaurantId: { userId, restaurantId },
    },
    select: { id: true },
  });
  if (membership) return true;
  // Fallback legacy : home store sans membership encore backfillé
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { restaurantId: true },
  });
  return user?.restaurantId === restaurantId;
}

export async function assertSameNetwork(
  aRestaurantId: string,
  bRestaurantId: string,
  db: TenantDb = prisma
): Promise<boolean> {
  const [a, b] = await Promise.all([
    db.restaurant.findUnique({
      where: { id: aRestaurantId },
      select: { networkId: true },
    }),
    db.restaurant.findUnique({
      where: { id: bRestaurantId },
      select: { networkId: true },
    }),
  ]);
  return Boolean(a?.networkId && b?.networkId && a.networkId === b.networkId);
}

export async function createSatelliteStore(input: {
  networkId: string;
  name: string;
  ownerUserId: string;
  whatsappTo?: string | null;
  db?: TenantDb;
}): Promise<{ ok: true; restaurantId: string } | { ok: false; error: string }> {
  const db = input.db ?? prisma;
  const network = await db.franchiseNetwork.findUnique({
    where: { id: input.networkId },
    include: {
      hqRestaurant: { select: { plan: true, billingPeriod: true } },
      _count: { select: { restaurants: true } },
    },
  });
  if (!network) return { ok: false, error: "Réseau introuvable." };

  const plan = resolvePlan(network.hqRestaurant.plan);
  if (network._count.restaurants >= plan.maxStores) {
    return {
      ok: false,
      error: `Plan ${plan.name} : max ${plan.maxStores} boutique(s) (actuel ${network._count.restaurants}).`,
    };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nom de boutique requis." };

  const restaurant = await db.restaurant.create({
    data: {
      name,
      timezone: "Europe/Paris",
      whatsappTo: input.whatsappTo?.trim() || null,
      plan: network.hqRestaurant.plan,
      billingPeriod: network.hqRestaurant.billingPeriod,
      stripeStatus: "none",
      active: true,
      networkId: network.id,
      onboardingCompletedAt: null,
    },
  });

  await db.userRestaurant.create({
    data: {
      userId: input.ownerUserId,
      restaurantId: restaurant.id,
      role: "OWNER",
    },
  });

  return { ok: true, restaurantId: restaurant.id };
}
