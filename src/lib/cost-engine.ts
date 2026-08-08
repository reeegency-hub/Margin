import { prisma } from "@/lib/db";

const PRICE_HIKE_PCT = 0.05; // 5 %

export type PriceHike = {
  ingredientId: string;
  name: string;
  unit: string;
  previousPrice: number;
  newPrice: number;
  deltaPct: number;
  deltaEur: number;
  at: Date;
};

export type TopDishCost = {
  dishId: string;
  label: string;
  qty: number;
  pct: number;
  salePrice: number;
  foodCost: number | null;
  foodCostPct: number | null;
  marginEur: number | null;
};

export type WeeklyLossSummary = {
  needsInventory: boolean;
  daysSinceLast: number | null;
  lastValidatedAt: Date | null;
  lossEur: number;
  gainEur: number;
  netEur: number;
  topLosses: { name: string; qty: number; unit: string; eur: number }[];
};

export type SupplierCompareRow = {
  ingredientId: string;
  name: string;
  unit: string;
  currentSupplier: string | null;
  currentPrice: number | null;
  cheapestSupplier: string;
  cheapestPrice: number;
  savingsPct: number;
  savingsEurPerUnit: number;
};

export type CostPilotSnapshot = {
  invoiceCount: number;
  pricedLineCount: number;
  hikesToday: PriceHike[];
  hikesWeek: PriceHike[];
  topDishCosts: TopDishCost[];
  weeklyLoss: WeeklyLossSummary;
  supplierCompare: SupplierCompareRow[];
  monthlySavingsPotential: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Coût matière d’un plat = Σ qty recette × dernier prix d’achat. */
export async function computeDishFoodCost(
  restaurantId: string,
  dishId: string
): Promise<number | null> {
  const dish = await prisma.dish.findFirst({
    where: { id: dishId, restaurantId },
    include: {
      ingredients: {
        include: {
          ingredient: {
            select: {
              lastPurchasePrice: true,
              catalogItems: { select: { price: true }, orderBy: { price: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!dish || dish.ingredients.length === 0) return null;

  let total = 0;
  let missing = 0;
  for (const line of dish.ingredients) {
    const unit =
      line.ingredient.lastPurchasePrice ??
      line.ingredient.catalogItems[0]?.price ??
      null;
    if (unit == null) {
      missing += 1;
      continue;
    }
    total += line.quantity * unit;
  }
  if (missing === dish.ingredients.length) return null;
  return round2(total);
}

/** Recalcule et stocke le coût matière des plats touchés (jour même). */
export async function refreshDishFoodCosts(
  restaurantId: string,
  ingredientIds?: string[]
) {
  const where =
    ingredientIds && ingredientIds.length > 0
      ? {
          restaurantId,
          ingredients: { some: { ingredientId: { in: ingredientIds } } },
        }
      : { restaurantId, active: true };

  const dishes = await prisma.dish.findMany({
    where,
    select: { id: true },
  });

  const now = new Date();
  for (const d of dishes) {
    const foodCost = await computeDishFoodCost(restaurantId, d.id);
    await prisma.dish.updateMany({
      where: { id: d.id, restaurantId },
      data: { foodCost, foodCostUpdatedAt: now },
    });
  }
  return dishes.length;
}

/**
 * Enregistre une hausse/baisse de prix et met à jour lastPurchasePrice.
 * Retourne true si hausse ≥ seuil.
 */
export async function applyPurchasePrice(opts: {
  restaurantId: string;
  ingredientId: string;
  unitPrice: number;
  supplierId?: string | null;
  source?: string;
}): Promise<{ hiked: boolean; previous: number | null }> {
  const { restaurantId, ingredientId, unitPrice, supplierId } = opts;
  if (!(unitPrice > 0)) return { hiked: false, previous: null };

  const ing = await prisma.ingredient.findFirst({
    where: { id: ingredientId, restaurantId },
    select: { lastPurchasePrice: true, name: true },
  });
  if (!ing) return { hiked: false, previous: null };

  const previous = ing.lastPurchasePrice;
  const hiked =
    previous != null &&
    previous > 0 &&
    unitPrice > previous * (1 + PRICE_HIKE_PCT);

  await prisma.$transaction([
    prisma.ingredientPriceEvent.create({
      data: {
        restaurantId,
        ingredientId,
        supplierId: supplierId || null,
        unitPrice,
        previousPrice: previous,
        source: opts.source || "RECEIPT",
      },
    }),
    prisma.ingredient.updateMany({
      where: { id: ingredientId, restaurantId },
      data: {
        lastPurchasePrice: unitPrice,
        lastPurchaseAt: new Date(),
      },
    }),
  ]);

  if (hiked && previous != null) {
    const deltaPct = round2(((unitPrice - previous) / previous) * 100);
    await prisma.alert.create({
      data: {
        restaurantId,
        type: "PRICE_INCREASE",
        severity: 2,
        status: "ACTIVE",
        title: `Hausse fournisseur — ${ing.name}`,
        constat: `${ing.name} : ${previous.toFixed(2)} € → ${unitPrice.toFixed(2)} € (+${deltaPct} %).`,
        cause: "Prix d’achat relevé sur une facture fournisseur.",
        impact: "Coût matière des plats concernés recalculé aujourd’hui.",
        action: "Vérifier la marge des best-sellers et négocier si besoin.",
        ingredientId,
      },
    });
  }

  return { hiked, previous };
}

export async function listPriceHikes(
  restaurantId: string,
  since: Date
): Promise<PriceHike[]> {
  const events = await prisma.ingredientPriceEvent.findMany({
    where: {
      restaurantId,
      createdAt: { gte: since },
      previousPrice: { not: null },
    },
    include: { ingredient: { select: { name: true, unit: true } } },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return events
    .filter((e) => {
      if (e.previousPrice == null || e.previousPrice <= 0) return false;
      return e.unitPrice > e.previousPrice * (1 + PRICE_HIKE_PCT);
    })
    .map((e) => {
      const previous = e.previousPrice!;
      return {
        ingredientId: e.ingredientId,
        name: e.ingredient.name,
        unit: e.ingredient.unit,
        previousPrice: previous,
        newPrice: e.unitPrice,
        deltaPct: round2(((e.unitPrice - previous) / previous) * 100),
        deltaEur: round2(e.unitPrice - previous),
        at: e.createdAt,
      };
    });
}

export async function getTopDishCosts(
  restaurantId: string,
  limit = 5
): Promise<TopDishCost[]> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const top = await prisma.saleItem.groupBy({
    by: ["dishId"],
    where: { sale: { restaurantId, soldAt: { gte: weekAgo } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const totalQty = top.reduce((s, t) => s + (t._sum.quantity || 0), 0) || 1;
  const dishes = await prisma.dish.findMany({
    where: { id: { in: top.map((t) => t.dishId) }, restaurantId },
    select: {
      id: true,
      name: true,
      salePrice: true,
      foodCost: true,
    },
  });
  const byId = new Map(dishes.map((d) => [d.id, d]));

  const rows: TopDishCost[] = [];
  for (const t of top) {
    const d = byId.get(t.dishId);
    if (!d) continue;
    let foodCost = d.foodCost;
    if (foodCost == null) {
      foodCost = await computeDishFoodCost(restaurantId, d.id);
      if (foodCost != null) {
        await prisma.dish.updateMany({
          where: { id: d.id, restaurantId },
          data: { foodCost, foodCostUpdatedAt: new Date() },
        });
      }
    }
    const qty = t._sum.quantity || 0;
    const foodCostPct =
      foodCost != null && d.salePrice > 0
        ? round2((foodCost / d.salePrice) * 100)
        : null;
    rows.push({
      dishId: d.id,
      label: d.name,
      qty,
      pct: round2((qty / totalQty) * 100),
      salePrice: d.salePrice,
      foodCost,
      foodCostPct,
      marginEur:
        foodCost != null ? round2(d.salePrice - foodCost) : null,
    });
  }
  return rows;
}

export async function getWeeklyLossSummary(
  restaurantId: string
): Promise<WeeklyLossSummary> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const last = await prisma.inventoryCount.findFirst({
    where: { restaurantId, status: "VALIDATED" },
    orderBy: { validatedAt: "desc" },
    select: { validatedAt: true },
  });

  const daysSinceLast = last?.validatedAt
    ? Math.floor(
        (Date.now() - last.validatedAt.getTime()) / (24 * 60 * 60 * 1000)
      )
    : null;

  const counts = await prisma.inventoryCount.findMany({
    where: {
      restaurantId,
      status: "VALIDATED",
      validatedAt: { gte: weekAgo },
    },
    include: {
      lines: {
        include: { ingredient: { select: { name: true, unit: true } } },
      },
    },
  });

  let lossEur = 0;
  let gainEur = 0;
  const lossMap = new Map<
    string,
    { name: string; qty: number; unit: string; eur: number }
  >();

  for (const c of counts) {
    for (const line of c.lines) {
      const value = line.varianceValueEur;
      if (value == null) continue;
      if (value < 0) {
        lossEur += Math.abs(value);
        const prev = lossMap.get(line.ingredientId) || {
          name: line.ingredient.name,
          qty: 0,
          unit: line.ingredient.unit,
          eur: 0,
        };
        prev.qty += Math.abs(line.varianceQty);
        prev.eur += Math.abs(value);
        lossMap.set(line.ingredientId, prev);
      } else if (value > 0) {
        gainEur += value;
      }
    }
  }

  const topLosses = [...lossMap.values()]
    .sort((a, b) => b.eur - a.eur)
    .slice(0, 5)
    .map((r) => ({
      ...r,
      qty: round2(r.qty),
      eur: round2(r.eur),
    }));

  return {
    needsInventory: daysSinceLast == null || daysSinceLast >= 7,
    daysSinceLast,
    lastValidatedAt: last?.validatedAt ?? null,
    lossEur: round2(lossEur),
    gainEur: round2(gainEur),
    netEur: round2(gainEur - lossEur),
    topLosses,
  };
}

/** Comparatif multi-fournisseurs — économies potentielles à négocier. */
export async function compareSuppliers(
  restaurantId: string
): Promise<SupplierCompareRow[]> {
  const items = await prisma.supplierCatalogItem.findMany({
    where: { supplier: { restaurantId } },
    include: {
      supplier: { select: { name: true } },
      ingredient: {
        select: {
          id: true,
          name: true,
          unit: true,
          lastPurchasePrice: true,
        },
      },
    },
  });

  const byIng = new Map<string, typeof items>();
  for (const it of items) {
    const list = byIng.get(it.ingredientId) || [];
    list.push(it);
    byIng.set(it.ingredientId, list);
  }

  const rows: SupplierCompareRow[] = [];
  for (const [, list] of byIng) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0]!;
    const current =
      sorted.find(
        (s) =>
          s.ingredient.lastPurchasePrice != null &&
          Math.abs(s.price - s.ingredient.lastPurchasePrice) < 0.001
      ) || sorted[sorted.length - 1]!;

    if (cheapest.price >= current.price) continue;
    const savingsEurPerUnit = round2(current.price - cheapest.price);
    const savingsPct = round2((savingsEurPerUnit / current.price) * 100);
    rows.push({
      ingredientId: cheapest.ingredientId,
      name: cheapest.ingredient.name,
      unit: cheapest.ingredient.unit,
      currentSupplier: current.supplier.name,
      currentPrice: current.price,
      cheapestSupplier: cheapest.supplier.name,
      cheapestPrice: cheapest.price,
      savingsPct,
      savingsEurPerUnit,
    });
  }

  return rows.sort((a, b) => b.savingsEurPerUnit - a.savingsEurPerUnit).slice(0, 12);
}

export async function getCostPilotSnapshot(
  restaurantId: string
): Promise<CostPilotSnapshot> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [invoiceCount, pricedLineCount, hikesToday, hikesWeek, topDishCosts, weeklyLoss, supplierCompare] =
    await Promise.all([
      prisma.supplierReceipt.count({ where: { restaurantId } }),
      prisma.supplierReceiptLine.count({
        where: {
          receipt: { restaurantId },
          unitPrice: { not: null },
        },
      }),
      listPriceHikes(restaurantId, startOfDay),
      listPriceHikes(restaurantId, weekAgo),
      getTopDishCosts(restaurantId),
      getWeeklyLossSummary(restaurantId),
      compareSuppliers(restaurantId),
    ]);

  const monthlySavingsPotential = round2(
    supplierCompare.reduce((s, r) => s + r.savingsEurPerUnit, 0)
  );

  return {
    invoiceCount,
    pricedLineCount,
    hikesToday,
    hikesWeek,
    topDishCosts,
    weeklyLoss,
    supplierCompare,
    monthlySavingsPotential,
  };
}
