import { prisma, type TenantDb, runTenantTx } from "@/lib/db";
import { StockAlertService } from "@/lib/stock-alert-service";
import { formatKitchenQty } from "@/lib/units";
import { queueStockAlertForWhatsApp, flushStockAlertBatch } from "@/lib/whatsapp/batch";
import { sendWhatsAppOutbound } from "@/lib/whatsapp/outbound";

export function formatQty(qty: number, unit: string, name?: string): string {
  return formatKitchenQty(qty, unit, name);
}

/** Average daily consumption over the last 7 days from SALE movements (absolute). */
export async function avgDailyConsumption(
  restaurantId: string,
  ingredientId: string,
  db: TenantDb = prisma
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const movements = await db.stockMovement.findMany({
    where: {
      restaurantId,
      ingredientId,
      type: "SALE",
      createdAt: { gte: since },
    },
  });

  const totalConsumed = movements.reduce((sum, m) => sum + Math.abs(m.deltaQty), 0);
  return totalConsumed / 7;
}

export function estimateRuptureLabel(
  stock: number,
  avgDaily: number
): string {
  if (avgDaily <= 0) {
    return "Consommation récente insuffisante pour estimer la rupture.";
  }
  const daysLeft = stock / avgDaily;
  if (daysLeft <= 0) return "Rupture déjà atteinte.";
  if (daysLeft < 0.5) return "Rupture estimée ce soir si aucune commande.";
  if (daysLeft < 1) return "Rupture estimée demain en début de service.";
  if (daysLeft < 1.5) return "Rupture estimée demain soir si aucune commande.";
  if (daysLeft < 3) {
    const d = Math.ceil(daysLeft);
    return `Rupture estimée dans environ ${d} jours.`;
  }
  return `Stock tenu environ ${Math.floor(daysLeft)} jours au rythme actuel.`;
}

export async function syncIngredientAlert(
  restaurantId: string,
  ingredientId: string,
  options?: { notify?: boolean; flushImmediate?: boolean; db?: TenantDb }
): Promise<void> {
  const db = options?.db ?? prisma;
  const ingredient = await db.ingredient.findFirst({
    where: { id: ingredientId, restaurantId },
    include: {
      restaurant: { include: { suppliers: { take: 1 } } },
    },
  });
  if (!ingredient) return;

  const existing = await db.alert.findFirst({
    where: {
      restaurantId,
      ingredientId,
      type: "STOCK_CRITICAL",
      status: "ACTIVE",
    },
  });

  if (ingredient.criticalThreshold <= 0) {
    // Seuils non configurés → pas d’alerte (évite le spam après import menu)
    if (existing) {
      await db.alert.updateMany({
        where: { id: existing.id, restaurantId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          whatsappPendingAt: null,
        },
      });
    }
    return;
  }

  // Remise à zéro du cycle d’alerte quand le stock repasse au-dessus du seuil
  if (ingredient.stockTheoretical > ingredient.criticalThreshold) {
    if (existing) {
      await db.alert.updateMany({
        where: { id: existing.id, restaurantId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          whatsappPendingAt: null,
        },
      });
    }
    return;
  }

  const avgDaily = await avgDailyConsumption(restaurantId, ingredientId, db);
  const impact = estimateRuptureLabel(ingredient.stockTheoretical, avgDaily);
  const supplierName =
    ingredient.restaurant.suppliers[0]?.name ?? "ton fournisseur habituel";
  const reorder = formatQty(ingredient.reorderQty, ingredient.unit);
  const stockLabel = formatQty(ingredient.stockTheoretical, ingredient.unit);

  const payload = {
    title: `Stock critique — ${ingredient.name}`,
    constat: `Il reste ${stockLabel} de ${ingredient.name}.`,
    cause: `Sous le seuil critique (${formatQty(ingredient.criticalThreshold, ingredient.unit)}).`,
    impact,
    action: `Commander ${reorder} chez ${supplierName}.`,
    severity: ingredient.stockTheoretical <= 0 ? 1 : 2,
  };

  let alertId: string;
  let alreadyAlertedThisCycle = false;

  if (existing) {
    const updated = await db.alert.update({
      where: { id: existing.id },
      data: payload,
    });
    alertId = updated.id;
    // Dédup : déjà notifié tant que l’alerte ACTIVE n’a pas été résolue
    alreadyAlertedThisCycle = Boolean(updated.whatsappSentAt);
  } else {
    const created = await db.alert.create({
      data: {
        restaurantId,
        ingredientId,
        type: "STOCK_CRITICAL",
        status: "ACTIVE",
        ...payload,
      },
    });
    alertId = created.id;
    alreadyAlertedThisCycle = false;
  }

  // Toujours en file batch si pas encore notifié sur ce cycle (dédup = whatsappSentAt)
  if (!alreadyAlertedThisCycle) {
    await queueStockAlertForWhatsApp(alertId);
    // Rupture totale → flush immédiat ; sinon fenêtre WHATSAPP_BATCH_MINUTES
    if (options?.flushImmediate || payload.severity <= 1) {
      await flushStockAlertBatch(restaurantId, { force: true });
    }
  }
}

export async function sendAlertWhatsApp(alertId: string): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: { restaurant: true, ingredient: true },
  });
  if (!alert || alert.status !== "ACTIVE") {
    return { sent: false, reason: "Alerte introuvable ou résolue" };
  }
  if (alert.whatsappSentAt) {
    return { sent: false, reason: "Déjà envoyée (cycle en cours)" };
  }

  const to = alert.restaurant.whatsappTo;
  if (!to) {
    return { sent: false, reason: "Numéro WhatsApp non configuré" };
  }

  const vars = {
    "1": alert.ingredient?.name || alert.title,
    "2": [alert.constat, alert.impact].filter(Boolean).join(" "),
    "3": alert.action,
  };

  const result = await sendWhatsAppOutbound({
    to,
    restaurantId: alert.restaurantId,
    purpose: "stock_alert",
    templateKey: "stock_alert",
    templateVars: vars,
    alertIds: [alertId],
  });

  if (!result.ok) {
    return { sent: false, reason: result.reason || "Envoi échoué" };
  }

  await prisma.alert.updateMany({
    where: { id: alertId, restaurantId: alert.restaurantId },
    data: { whatsappSentAt: new Date(), whatsappPendingAt: null },
  });

  return { sent: true };
}

type SaleLineInput = { dishId: string; quantity: number };

export type SaleOptions = {
  channel?: string;
  kioskId?: string | null;
  externalOrderId?: string | null;
  soldAt?: Date | null;
  db?: TenantDb;
};

export async function recordSale(
  restaurantId: string,
  lines: SaleLineInput[],
  options?: SaleOptions
) {
  if (lines.length === 0) throw new Error("Aucune ligne de vente");
  const db = options?.db ?? prisma;

  const dishIds = lines.map((l) => l.dishId);
  const dishes = await db.dish.findMany({
    where: { restaurantId, id: { in: dishIds }, active: true },
    include: { ingredients: true },
  });
  if (dishes.length !== new Set(dishIds).size) {
    throw new Error("Plat introuvable");
  }

  const dishMap = new Map(dishes.map((d) => [d.id, d]));
  let totalAmount = 0;
  const consumption = new Map<string, number>();

  for (const line of lines) {
    const dish = dishMap.get(line.dishId)!;
    totalAmount += dish.salePrice * line.quantity;
    for (const ri of dish.ingredients) {
      const delta = ri.quantity * line.quantity;
      consumption.set(ri.ingredientId, (consumption.get(ri.ingredientId) ?? 0) + delta);
    }
  }

  const sale = await runTenantTx(db, async (tx) => {
    const created = await tx.sale.create({
      data: {
        restaurantId,
        totalAmount,
        channel: options?.channel ?? "dine_in",
        kioskId: options?.kioskId ?? null,
        externalOrderId: options?.externalOrderId ?? null,
        soldAt: options?.soldAt ?? undefined,
        items: {
          create: lines.map((line) => {
            const dish = dishMap.get(line.dishId)!;
            return {
              dishId: line.dishId,
              quantity: line.quantity,
              unitPrice: dish.salePrice,
            };
          }),
        },
      },
      include: { items: true },
    });

    for (const [ingredientId, qty] of consumption) {
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: { stockTheoretical: { decrement: qty } },
      });
      await tx.stockMovement.create({
        data: {
          restaurantId,
          ingredientId,
          type: "SALE",
          deltaQty: -qty,
          refType: "Sale",
          refId: created.id,
        },
      });
    }

    return created;
  });

  // Alertes dashboard produit par produit (sans WA) + un seul récap modal
  for (const ingredientId of consumption.keys()) {
    await syncIngredientAlert(restaurantId, ingredientId, { notify: false, db });
  }
  await StockAlertService.run(restaurantId);

  return sale;
}

/**
 * Annule une vente POS (cancel/void) : restaure le stock et marque la vente.
 * Idempotent si déjà `pos_cancelled`.
 */
export async function voidSaleByExternalOrderId(
  restaurantId: string,
  externalOrderId: string,
  db: TenantDb = prisma
): Promise<{
  found: boolean;
  alreadyVoided?: boolean;
  saleId?: string;
}> {
  const orderId = externalOrderId.trim();
  if (!orderId) return { found: false };

  const sale = await db.sale.findFirst({
    where: { restaurantId, externalOrderId: orderId },
    include: {
      items: true,
    },
  });
  if (!sale) return { found: false };
  if (sale.channel === "pos_cancelled") {
    return { found: true, alreadyVoided: true, saleId: sale.id };
  }

  const dishIds = sale.items.map((i) => i.dishId);
  const dishes = await db.dish.findMany({
    where: { restaurantId, id: { in: dishIds } },
    include: { ingredients: true },
  });
  const dishMap = new Map(dishes.map((d) => [d.id, d]));
  const restore = new Map<string, number>();

  for (const item of sale.items) {
    const dish = dishMap.get(item.dishId);
    if (!dish) continue;
    for (const ri of dish.ingredients) {
      const delta = ri.quantity * item.quantity;
      restore.set(ri.ingredientId, (restore.get(ri.ingredientId) ?? 0) + delta);
    }
  }

  await runTenantTx(db, async (tx) => {
    for (const [ingredientId, qty] of restore) {
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: { stockTheoretical: { increment: qty } },
      });
      await tx.stockMovement.create({
        data: {
          restaurantId,
          ingredientId,
          type: "VOID_SALE",
          deltaQty: qty,
          refType: "Sale",
          refId: sale.id,
        },
      });
    }
    await tx.sale.update({
      where: { id: sale.id },
      data: { channel: "pos_cancelled" },
    });
  });

  for (const ingredientId of restore.keys()) {
    await syncIngredientAlert(restaurantId, ingredientId, { notify: false, db });
  }
  await StockAlertService.run(restaurantId);

  return { found: true, saleId: sale.id };
}

type ReceiptLineInput = {
  ingredientId: string;
  quantity: number;
  unitPrice?: number | null;
};

export async function recordReceipt(
  restaurantId: string,
  supplierId: string,
  lines: ReceiptLineInput[],
  note?: string,
  db: TenantDb = prisma
) {
  if (lines.length === 0) throw new Error("Aucune ligne de réception");

  const ingredients = await db.ingredient.findMany({
    where: {
      restaurantId,
      id: { in: lines.map((l) => l.ingredientId) },
    },
  });
  if (ingredients.length !== new Set(lines.map((l) => l.ingredientId)).size) {
    throw new Error("Ingrédient introuvable");
  }

  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, restaurantId },
  });
  if (!supplier) throw new Error("Fournisseur introuvable");

  const receipt = await runTenantTx(db, async (tx) => {
    const created = await tx.supplierReceipt.create({
      data: {
        restaurantId,
        supplierId,
        note: note || null,
        lines: {
          create: lines.map((l) => ({
            ingredientId: l.ingredientId,
            quantity: l.quantity,
            unitPrice:
              l.unitPrice != null && l.unitPrice > 0 ? l.unitPrice : null,
          })),
        },
      },
      include: { lines: true },
    });

    for (const line of lines) {
      await tx.ingredient.update({
        where: { id: line.ingredientId },
        data: { stockTheoretical: { increment: line.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          restaurantId,
          ingredientId: line.ingredientId,
          type: "RECEIPT",
          deltaQty: line.quantity,
          refType: "SupplierReceipt",
          refId: created.id,
        },
      });
    }

    return created;
  });

  const pricedIds: string[] = [];
  const { applyPurchasePrice, refreshDishFoodCosts } = await import(
    "@/lib/cost-engine"
  );
  for (const line of lines) {
    if (line.unitPrice != null && line.unitPrice > 0) {
      await applyPurchasePrice({
        restaurantId,
        ingredientId: line.ingredientId,
        unitPrice: line.unitPrice,
        supplierId,
        source: "RECEIPT",
      });
      pricedIds.push(line.ingredientId);
    }
  }

  // Hausse fournisseur → recalcul coût matière des plats le jour même
  if (pricedIds.length > 0) {
    await refreshDishFoodCosts(restaurantId, pricedIds);
  }

  for (const line of lines) {
    await syncIngredientAlert(restaurantId, line.ingredientId, {
      notify: false,
      db,
    });
  }

  await StockAlertService.run(restaurantId);

  return receipt;
}
