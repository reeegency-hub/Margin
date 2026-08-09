import { prisma } from "@/lib/db";

const PRICE_HIKE_PCT = 0.05; // 5 %

export type PriceHike = {
  stockUnitId: string;
  name: string;
  unit: string;
  previousPrice: number;
  newPrice: number;
  deltaPct: number;
  deltaEur: number;
  at: Date;
};

export type TopDishCost = {
  productId: string;
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
  stockUnitId: string;
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
  productId: string
): Promise<number | null> {
  const dish = await prisma.product.findFirst({
    where: { id: productId, restaurantId },
    include: { productStocks: {
        include: {
          stockUnit: {
            select: {
              lastPurchasePrice: true,
              catalogItems: { select: { price: true }, orderBy: { price: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!dish || dish.productStocks.length === 0) return null;

  let total = 0;
  let missing = 0;
  for (const line of dish.productStocks) {
    const unit =
      line.stockUnit.lastPurchasePrice ??
      line.stockUnit.catalogItems[0]?.price ??
      null;
    if (unit == null) {
      missing += 1;
      continue;
    }
    total += line.quantity * unit;
  }
  if (missing === dish.productStocks.length) return null;
  return round2(total);
}

/** Recalcule et stocke le coût matière des plats touchés (jour même). */
export async function refreshDishFoodCosts(
  restaurantId: string,
  stockUnitIds?: string[]
) {
  const where =
    stockUnitIds && stockUnitIds.length > 0
      ? {
          restaurantId,
          productStocks: { some: { stockUnitId: { in: stockUnitIds } } },
        }
      : { restaurantId, active: true };

  const dishes = await prisma.product.findMany({
    where,
    select: { id: true },
  });

  const now = new Date();
  for (const d of dishes) {
    const foodCost = await computeDishFoodCost(restaurantId, d.id);
    await prisma.product.updateMany({
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
  stockUnitId: string;
  unitPrice: number;
  supplierId?: string | null;
  source?: string;
}): Promise<{ hiked: boolean; previous: number | null }> {
  const { restaurantId, stockUnitId, unitPrice, supplierId } = opts;
  if (!(unitPrice > 0)) return { hiked: false, previous: null };

  const ing = await prisma.stockUnit.findFirst({
    where: { id: stockUnitId, restaurantId },
    select: { lastPurchasePrice: true, name: true },
  });
  if (!ing) return { hiked: false, previous: null };

  const previous = ing.lastPurchasePrice;
  const hiked =
    previous != null &&
    previous > 0 &&
    unitPrice > previous * (1 + PRICE_HIKE_PCT);

  await prisma.$transaction([
    prisma.stockUnitPriceEvent.create({
      data: {
        restaurantId,
        stockUnitId,
        supplierId: supplierId || null,
        unitPrice,
        previousPrice: previous,
        source: opts.source || "RECEIPT",
      },
    }),
    prisma.stockUnit.updateMany({
      where: { id: stockUnitId, restaurantId },
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
        stockUnitId,
      },
    });
  }

  return { hiked, previous };
}

export async function listPriceHikes(
  restaurantId: string,
  since: Date
): Promise<PriceHike[]> {
  const events = await prisma.stockUnitPriceEvent.findMany({
    where: {
      restaurantId,
      createdAt: { gte: since },
      previousPrice: { not: null },
    },
    include: { stockUnit: { select: { name: true, unit: true } } },
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
        stockUnitId: e.stockUnitId,
        name: e.stockUnit.name,
        unit: e.stockUnit.unit,
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
    by: ["productId"],
    where: { sale: { restaurantId, soldAt: { gte: weekAgo } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const totalQty = top.reduce((s, t) => s + (t._sum.quantity || 0), 0) || 1;
  const dishes = await prisma.product.findMany({
    where: { id: { in: top.map((t) => t.productId) }, restaurantId },
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
    const d = byId.get(t.productId);
    if (!d) continue;
    let foodCost = d.foodCost;
    if (foodCost == null) {
      foodCost = await computeDishFoodCost(restaurantId, d.id);
      if (foodCost != null) {
        await prisma.product.updateMany({
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
      productId: d.id,
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
        include: { stockUnit: { select: { name: true, unit: true } } },
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
        const prev = lossMap.get(line.stockUnitId) || {
          name: line.stockUnit.name,
          qty: 0,
          unit: line.stockUnit.unit,
          eur: 0,
        };
        prev.qty += Math.abs(line.varianceQty);
        prev.eur += Math.abs(value);
        lossMap.set(line.stockUnitId, prev);
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
      stockUnit: {
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
    const list = byIng.get(it.stockUnitId) || [];
    list.push(it);
    byIng.set(it.stockUnitId, list);
  }

  const rows: SupplierCompareRow[] = [];
  for (const [, list] of byIng) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0]!;
    const current =
      sorted.find(
        (s) =>
          s.stockUnit.lastPurchasePrice != null &&
          Math.abs(s.price - s.stockUnit.lastPurchasePrice) < 0.001
      ) || sorted[sorted.length - 1]!;

    if (cheapest.price >= current.price) continue;
    const savingsEurPerUnit = round2(current.price - cheapest.price);
    const savingsPct = round2((savingsEurPerUnit / current.price) * 100);
    rows.push({
      stockUnitId: cheapest.stockUnitId,
      name: cheapest.stockUnit.name,
      unit: cheapest.stockUnit.unit,
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
