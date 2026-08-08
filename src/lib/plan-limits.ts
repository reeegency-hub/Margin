import { prisma, type TenantDb } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";

function resolvePlan(plan: string | null | undefined) {
  const id = (plan || "commerce") as PlanId;
  return PLANS.find((p) => p.id === id) || PLANS[0];
}

/**
 * Gate catalogue : refuse d’ajouter `addCount` produits si le plan est plafonné.
 * Compte les Ingredient (produits stock) du tenant.
 */
export async function assertCanAddProducts(
  restaurantId: string,
  addCount: number,
  db: TenantDb = prisma
): Promise<{ ok: true } | { ok: false; error: string; max: number; current: number }> {
  if (!(addCount > 0)) return { ok: true };

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { plan: true },
  });
  const plan = resolvePlan(restaurant?.plan);
  if (plan.maxProducts == null) return { ok: true };

  const current = await db.ingredient.count({ where: { restaurantId } });
  if (current + addCount > plan.maxProducts) {
    return {
      ok: false,
      error: `Plan ${plan.name} : plafond ${plan.maxProducts} produits (actuel ${current}, +${addCount}). Passez Franchise ou archivez des produits.`,
      max: plan.maxProducts,
      current,
    };
  }
  return { ok: true };
}

/** Gate multi-boutiques (admin create store). */
export async function assertCanAddStore(
  ownerEmail: string,
  db: TenantDb = prisma
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await db.user.findUnique({
    where: { email: ownerEmail },
    select: { restaurant: { select: { plan: true, id: true } } },
  });
  // Admin crée des commerces indépendants — limite par plan du commerce parent n’existe pas encore.
  // On compte les restaurants actifs du même email gérant si multi-compte ; sinon no-op soft.
  if (!user?.restaurant) return { ok: true };
  const plan = resolvePlan(user.restaurant.plan);
  const storeCount = await db.restaurant.count({
    where: { users: { some: { email: ownerEmail } }, active: true },
  });
  if (storeCount >= plan.maxStores) {
    return {
      ok: false,
      error: `Plan ${plan.name} : max ${plan.maxStores} boutique(s) (actuel ${storeCount}).`,
    };
  }
  return { ok: true };
}
