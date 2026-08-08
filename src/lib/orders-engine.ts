import { prisma, type TenantDb } from "@/lib/db";
import { ForecastService } from "@/lib/forecast-service";

/**
 * Liste de courses pour le gérant (il fait les courses lui-même).
 * Pas de commande automatique fournisseurs / multi-fournisseurs (hors scope produit).
 */
export async function ensureSelfShopSupplier(
  restaurantId: string,
  db: TenantDb = prisma
) {
  const existing = await db.supplier.findFirst({
    where: { restaurantId, name: "Mes courses" },
  });
  if (existing) return existing;
  return db.supplier.create({
    data: {
      restaurantId,
      name: "Mes courses",
      contact: null,
      deliveryDays: "[]",
      avgDeliveryDelayHours: 0,
      reliabilityScore: 1,
    },
  });
}

const HORIZON_DAYS = 3;

async function avgDailyMap(
  restaurantId: string,
  ingredientIds: string[],
  db: TenantDb
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!ingredientIds.length) return map;

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const movements = await db.stockMovement.findMany({
    where: {
      restaurantId,
      ingredientId: { in: ingredientIds },
      type: "SALE",
      createdAt: { gte: since },
    },
    select: { ingredientId: true, deltaQty: true },
  });

  const totals = new Map<string, number>();
  for (const m of movements) {
    totals.set(
      m.ingredientId,
      (totals.get(m.ingredientId) || 0) + Math.abs(m.deltaQty)
    );
  }
  for (const id of ingredientIds) {
    map.set(id, (totals.get(id) || 0) / 7);
  }
  return map;
}

export type ShoppingNeed = {
  ingredientId: string;
  name: string;
  unit: string;
  quantity: number;
  stock: number;
  /** missing = déjà sous seuil ; soon = risque sous 2–3 jours */
  reason: "missing" | "soon";
  daysLeft: number | null;
};

/**
 * Produits déjà manquants + ceux qui manqueront dans ~2–3 jours
 * au rythme de vente actuel.
 */
export async function computeShoppingNeeds(
  restaurantId: string,
  db: TenantDb = prisma
): Promise<ShoppingNeed[]> {
  const ingredients = await db.ingredient.findMany({
    where: { restaurantId },
    orderBy: { name: "asc" },
  });
  if (!ingredients.length) return [];

  const avgMap = await avgDailyMap(
    restaurantId,
    ingredients.map((i) => i.id),
    db
  );

  const needs: ShoppingNeed[] = [];

  for (const ing of ingredients) {
    const avgDaily = avgMap.get(ing.id) || 0;
    const under =
      ing.criticalThreshold > 0 &&
      ing.stockTheoretical <= ing.criticalThreshold;
    const daysLeft =
      avgDaily > 0 ? ing.stockTheoretical / avgDaily : null;
    const soon =
      !under &&
      daysLeft != null &&
      daysLeft > 0 &&
      daysLeft <= HORIZON_DAYS;

    if (!under && !soon) continue;

    const quantity = ForecastService.recommendQty({
      stockTheoretical: ing.stockTheoretical,
      criticalThreshold: Math.max(ing.criticalThreshold, 0),
      reorderQty: ing.reorderQty,
      avgDaily,
      coverDays: HORIZON_DAYS,
    });

    needs.push({
      ingredientId: ing.id,
      name: ing.name,
      unit: ing.unit,
      quantity: Math.max(quantity, 1),
      stock: ing.stockTheoretical,
      reason: under ? "missing" : "soon",
      daysLeft,
    });
  }

  needs.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === "missing" ? -1 : 1;
    const da = a.daysLeft ?? 0;
    const dbays = b.daysLeft ?? 0;
    return da - dbays;
  });

  return needs;
}

/**
 * Agrège tous les besoins (manque + 2–3 jours) en UNE liste « À faire ».
 */
export async function proposePurchaseOrders(
  restaurantId: string,
  db: TenantDb = prisma
) {
  const needs = await computeShoppingNeeds(restaurantId, db);
  if (needs.length === 0) {
    return {
      created: 0,
      message: "Rien à racheter pour les 2–3 prochains jours.",
    };
  }

  await db.purchaseOrder.updateMany({
    where: { restaurantId, status: "TO_VALIDATE" },
    data: { status: "CANCELLED" },
  });

  const self = await ensureSelfShopSupplier(restaurantId, db);
  const lines = needs.map((n) => ({
    ingredientId: n.ingredientId,
    quantity: n.quantity,
    unitPrice: 0,
    chosenReason:
      n.reason === "missing"
        ? "Manque déjà — sous le seuil"
        : `Risque sous ${HORIZON_DAYS} jours`,
  }));

  await db.purchaseOrder.create({
    data: {
      restaurantId,
      supplierId: self.id,
      status: "TO_VALIDATE",
      totalAmount: 0,
      proposedAt: new Date(),
      lines: { create: lines },
    },
  });

  return {
    created: 1,
    message: `Liste prête : ${lines.length} produit(s).`,
  };
}

/** @deprecated fournisseur — conservé pour compat, redirige vers liste perso */
export async function createManualPurchaseOrder(
  restaurantId: string,
  params: {
    ingredientId: string;
    supplierId?: string;
    quantity: number;
  },
  db: TenantDb = prisma
) {
  const ingredient = await db.ingredient.findFirst({
    where: { id: params.ingredientId, restaurantId },
  });
  if (!ingredient) throw new Error("Ingrédient introuvable");

  const qty = Number(params.quantity);
  if (!(qty > 0)) throw new Error("Quantité invalide");

  const self = await ensureSelfShopSupplier(restaurantId, db);

  return db.purchaseOrder.create({
    data: {
      restaurantId,
      supplierId: self.id,
      status: "TO_VALIDATE",
      totalAmount: 0,
      proposedAt: new Date(),
      lines: {
        create: [
          {
            ingredientId: ingredient.id,
            quantity: qty,
            unitPrice: 0,
            chosenReason: "Ajout manuel depuis le stock",
          },
        ],
      },
    },
  });
}

export async function validatePurchaseOrder(
  restaurantId: string,
  orderId: string,
  db: TenantDb = prisma
) {
  const order = await db.purchaseOrder.findFirst({
    where: { id: orderId, restaurantId },
  });
  if (!order) throw new Error("Liste introuvable");

  await db.purchaseOrder.updateMany({
    where: { id: orderId, restaurantId },
    data: {
      status: "SENT",
      validatedAt: new Date(),
      sentAt: new Date(),
    },
  });
  return db.purchaseOrder.findFirst({
    where: { id: orderId, restaurantId },
  });
}

/** Marque la liste courante comme faite et réintègre le stock (réception). */
export async function validateAllOpenOrders(
  restaurantId: string,
  db: TenantDb = prisma
) {
  const result = await proposePurchaseOrders(restaurantId, db);
  if (!result.created) {
    // peut déjà exister une liste TO_VALIDATE
  }

  const open = await db.purchaseOrder.findMany({
    where: { restaurantId, status: "TO_VALIDATE" },
    include: { lines: true },
  });
  if (!open.length) return { count: 0 };

  const { recordReceipt } = await import("@/lib/stock-engine");

  for (const order of open) {
    const lines = order.lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({
        ingredientId: l.ingredientId,
        quantity: l.quantity,
      }));
    if (lines.length) {
      await recordReceipt(
        restaurantId,
        order.supplierId,
        lines,
        "Courses marquées faites",
        db
      );
    }
    const now = new Date();
    await db.purchaseOrder.updateMany({
      where: { id: order.id, restaurantId },
      data: {
        status: "RECEIVED",
        validatedAt: now,
        sentAt: now,
      },
    });
  }
  return { count: open.length };
}

export async function cancelPurchaseOrder(
  restaurantId: string,
  orderId: string,
  db: TenantDb = prisma
) {
  const order = await db.purchaseOrder.findFirst({
    where: { id: orderId, restaurantId },
  });
  if (!order) throw new Error("Liste introuvable");

  return db.purchaseOrder.updateMany({
    where: { id: orderId, restaurantId },
    data: { status: "CANCELLED" },
  });
}

export async function kitchenCheckPurchaseOrder(
  restaurantId: string,
  orderId: string,
  checkedBy: string,
  db: TenantDb = prisma
) {
  const order = await db.purchaseOrder.findFirst({
    where: { id: orderId, restaurantId },
  });
  if (!order) throw new Error("Liste introuvable");

  return db.purchaseOrder.updateMany({
    where: { id: orderId, restaurantId },
    data: {
      kitchenCheckedAt: new Date(),
      kitchenCheckedBy: checkedBy.slice(0, 80) || "Rayon",
    },
  });
}
