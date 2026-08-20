/**
 * Synchronisation des anomalies catalogue persistées + actions de nettoyage.
 */
import { prisma } from "@/lib/db";
import { normalizeCatalogName } from "@/lib/catalog/normalize";
import { inferCategory } from "@/lib/catalog/normalize";
import { applyUnitDefaults } from "@/lib/units";

const STALE_PRICE_DAYS = 90;

export async function syncCatalogIssues(restaurantId: string): Promise<{
  open: number;
  created: number;
}> {
  const [ingredients, dishes, ignored] = await Promise.all([
    prisma.stockUnit.findMany({ where: { restaurantId } }),
    prisma.product.findMany({
      where: { restaurantId },
      select: {
        id: true,
        name: true,
        salePrice: true,
        updatedAt: true,
        externalSku: true,
      },
    }),
    prisma.catalogIssue.findMany({
      where: { restaurantId, status: "IGNORED" },
      select: { kind: true, stockUnitId: true, stockUnitIdB: true, productId: true, payloadJson: true },
    }),
  ]);

  const ignoredKeys = new Set(
    ignored.map(
      (i) =>
        i.payloadJson ||
        `${i.kind}:${i.stockUnitId || ""}:${i.stockUnitIdB || ""}:${i.productId || ""}`
    )
  );

  const desired: Array<{
    kind: string;
    title: string;
    detail?: string;
    stockUnitId?: string;
    stockUnitIdB?: string;
    productId?: string;
    payloadKey: string;
  }> = [];

  // Doublons ingrédients (même nom normalisé)
  const byNorm = new Map<string, typeof ingredients>();
  for (const ing of ingredients) {
    const k = normalizeCatalogName(ing.name);
    const list = byNorm.get(k) || [];
    list.push(ing);
    byNorm.set(k, list);
  }
  for (const [, group] of byNorm) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const keep = sorted[0];
    for (const dup of sorted.slice(1)) {
      const payloadKey = `duplicate_ingredient:${keep.id}:${dup.id}`;
      if (ignoredKeys.has(payloadKey)) continue;
      desired.push({
        kind: "duplicate_ingredient",
        title: `Doublon stock : « ${keep.name} » / « ${dup.name} »`,
        detail: "Fusionnez pour éviter des seuils et alertes divergents.",
        stockUnitId: keep.id,
        stockUnitIdB: dup.id,
        payloadKey,
      });
    }
  }

  // Doublons plats (nom ou SKU)
  const dishByNorm = new Map<string, typeof dishes>();
  for (const d of dishes) {
    const k = normalizeCatalogName(d.name);
    const list = dishByNorm.get(k) || [];
    list.push(d);
    dishByNorm.set(k, list);
  }
  for (const [, group] of dishByNorm) {
    if (group.length < 2) continue;
    const keep = group[0];
    for (const dup of group.slice(1)) {
      const payloadKey = `duplicate_dish:${keep.id}:${dup.id}`;
      if (ignoredKeys.has(payloadKey)) continue;
      desired.push({
        kind: "duplicate_dish",
        title: `Doublon produit : « ${keep.name} »`,
        detail: "Deux fiches avec le même nom — renommez ou archivez.",
        productId: dup.id,
        payloadKey,
      });
    }
  }

  // Prix
  const staleBefore = new Date(Date.now() - STALE_PRICE_DAYS * 86400000);
  for (const d of dishes) {
    if (!(d.salePrice > 0)) {
      const payloadKey = `zero_price:${d.id}`;
      if (!ignoredKeys.has(payloadKey)) {
        desired.push({
          kind: "zero_price",
          title: `Prix à 0 — ${d.name}`,
          productId: d.id,
          payloadKey,
        });
      }
    } else if (d.salePrice > 500 || d.salePrice < 0) {
      const payloadKey = `aberrant_price:${d.id}`;
      if (!ignoredKeys.has(payloadKey)) {
        desired.push({
          kind: "aberrant_price",
          title: `Prix aberrant (${d.salePrice} €) — ${d.name}`,
          productId: d.id,
          payloadKey,
        });
      }
    } else if (d.updatedAt < staleBefore) {
      const payloadKey = `stale_price:${d.id}`;
      if (!ignoredKeys.has(payloadKey)) {
        desired.push({
          kind: "stale_price",
          title: `Prix non mis à jour depuis ${STALE_PRICE_DAYS} j — ${d.name}`,
          detail: `Dernière touche : ${d.updatedAt.toLocaleDateString("fr-FR")}`,
          productId: d.id,
          payloadKey,
        });
      }
    }
  }

  // Unités
  for (const ing of ingredients) {
    if (!["g", "ml", "pcs"].includes(ing.unit)) {
      const payloadKey = `bad_unit:${ing.id}`;
      if (!ignoredKeys.has(payloadKey)) {
        desired.push({
          kind: "bad_unit",
          title: `Unité invalide « ${ing.unit} » — ${ing.name}`,
          detail: `Suggéré : ${applyUnitDefaults(ing.name).unit}`,
          stockUnitId: ing.id,
          payloadKey,
        });
      }
    }
  }

  // Seuils manquants avec mouvement de stock / ventes
  const withSales = await prisma.stockMovement.groupBy({
    by: ["stockUnitId"],
    where: {
      restaurantId,
      type: "SALE",
      createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
    },
    _count: { _all: true },
  });
  const soldIds = new Set(withSales.map((r) => r.stockUnitId));

  for (const ing of ingredients) {
    if (ing.criticalThreshold > 0) continue;
    if (!soldIds.has(ing.id) && withSales.length > 0) {
      // pas de vente récente → info plus douce seulement si jamais de seuil et stock bougé
    }
    if (soldIds.has(ing.id)) {
      const payloadKey = `missing_threshold:${ing.id}`;
      if (!ignoredKeys.has(payloadKey)) {
        desired.push({
          kind: "missing_threshold",
          title: `Pas de seuil — ${ing.name} a des ventes`,
          detail: "Configurez un seuil pour être alerté avant rupture.",
          stockUnitId: ing.id,
          payloadKey,
        });
      }
    }
  }

  // Upsert OPEN issues : recreate open set for syncable kinds
  const openExisting = await prisma.catalogIssue.findMany({
    where: { restaurantId, status: "OPEN" },
  });
  const openByKey = new Map(
    openExisting.map((i) => [i.payloadJson || `${i.kind}:${i.id}`, i])
  );

  let created = 0;
  const keepKeys = new Set(desired.map((d) => d.payloadKey));

  for (const d of desired) {
    if (openByKey.has(d.payloadKey)) continue;
    await prisma.catalogIssue.create({
      data: {
        restaurantId,
        kind: d.kind,
        status: "OPEN",
        title: d.title,
        detail: d.detail || null,
        stockUnitId: d.stockUnitId || null,
        stockUnitIdB: d.stockUnitIdB || null,
        productId: d.productId || null,
        payloadJson: d.payloadKey,
      },
    });
    created += 1;
  }

  // Auto-resolve OPEN issues no longer relevant
  for (const ex of openExisting) {
    const key = ex.payloadJson || "";
    if (key && !keepKeys.has(key)) {
      await prisma.catalogIssue.update({
        where: { id: ex.id },
        data: { status: "RESOLVED" },
      });
    }
  }

  const open = await prisma.catalogIssue.count({
    where: { restaurantId, status: "OPEN" },
  });

  return { open, created };
}

export async function mergeIngredients(
  restaurantId: string,
  keepId: string,
  removeId: string
): Promise<{ ok: boolean; error?: string }> {
  if (keepId === removeId) {
    return { ok: false, error: "Même référence" };
  }
  const [keep, remove] = await Promise.all([
    prisma.stockUnit.findFirst({ where: { id: keepId, restaurantId } }),
    prisma.stockUnit.findFirst({ where: { id: removeId, restaurantId } }),
  ]);
  if (!keep || !remove) return { ok: false, error: "Référence introuvable" };

  await prisma.$transaction(async (tx) => {
    // Reassign recipe lines (merge quantities if both on same dish)
    const removeLines = await tx.productStock.findMany({
      where: { stockUnitId: removeId },
    });
    for (const line of removeLines) {
      const existing = await tx.productStock.findUnique({
        where: {
          productId_stockUnitId: {
            productId: line.productId,
            stockUnitId: keepId,
          },
        },
      });
      if (existing) {
        await tx.productStock.updateMany({
          where: {
            id: existing.id,
            product: { restaurantId },
          },
          data: { quantity: existing.quantity + line.quantity },
        });
        await tx.productStock.deleteMany({
          where: {
            id: line.id,
            product: { restaurantId },
          },
        });
      } else {
        await tx.productStock.updateMany({
          where: {
            id: line.id,
            product: { restaurantId },
          },
          data: { stockUnitId: keepId },
        });
      }
    }

    await tx.stockMovement.updateMany({
      where: { restaurantId, stockUnitId: removeId },
      data: { stockUnitId: keepId },
    });
    await tx.alert.updateMany({
      where: { restaurantId, stockUnitId: removeId },
      data: { stockUnitId: keepId },
    });
    await tx.supplierCatalogItem.deleteMany({
      where: {
        stockUnitId: removeId,
        supplier: { restaurantId },
      },
    });
    await tx.purchaseOrderLine.updateMany({
      where: {
        stockUnitId: removeId,
        order: { restaurantId },
      },
      data: { stockUnitId: keepId },
    });
    await tx.inventoryCountLine.updateMany({
      where: {
        stockUnitId: removeId,
        inventoryCount: { restaurantId },
      },
      data: { stockUnitId: keepId },
    });

    // Merge stock
    await tx.stockUnit.updateMany({
      where: { id: keepId, restaurantId },
      data: {
        stockTheoretical: keep.stockTheoretical + remove.stockTheoretical,
        criticalThreshold:
          keep.criticalThreshold > 0
            ? keep.criticalThreshold
            : remove.criticalThreshold,
        reorderQty:
          keep.reorderQty > 0 ? keep.reorderQty : remove.reorderQty,
      },
    });

    await tx.stockUnit.deleteMany({
      where: { id: removeId, restaurantId },
    });

    await tx.catalogIssue.updateMany({
      where: {
        restaurantId,
        status: "OPEN",
        OR: [
          { stockUnitId: removeId },
          { stockUnitIdB: removeId },
          { stockUnitId: keepId, stockUnitIdB: removeId },
        ],
      },
      data: { status: "RESOLVED" },
    });
  });

  return { ok: true };
}

export async function applySuggestedUnit(
  restaurantId: string,
  stockUnitId: string
): Promise<{ ok: boolean }> {
  const ing = await prisma.stockUnit.findFirst({
    where: { id: stockUnitId, restaurantId },
  });
  if (!ing) return { ok: false };
  const defaults = applyUnitDefaults(ing.name);
  await prisma.stockUnit.updateMany({
    where: { id: stockUnitId, restaurantId },
    data: {
      unit: defaults.unit,
      category: inferCategory(ing.name),
    },
  });
  await prisma.catalogIssue.updateMany({
    where: {
      restaurantId,
      stockUnitId,
      kind: { in: ["bad_unit", "missing_unit"] },
      status: "OPEN",
    },
    data: { status: "RESOLVED" },
  });
  return { ok: true };
}

export async function applySuggestedThreshold(
  restaurantId: string,
  stockUnitId: string
): Promise<{ ok: boolean }> {
  const ing = await prisma.stockUnit.findFirst({
    where: { id: stockUnitId, restaurantId },
  });
  if (!ing) return { ok: false };
  const defaults = applyUnitDefaults(ing.name);
  await prisma.stockUnit.updateMany({
    where: { id: stockUnitId, restaurantId },
    data: {
      criticalThreshold: defaults.criticalThreshold,
      reorderQty:
        ing.reorderQty > 0 ? ing.reorderQty : defaults.reorderQty,
      thresholdSource: "unit_default",
      category: inferCategory(ing.name),
    },
  });
  await prisma.catalogIssue.updateMany({
    where: {
      restaurantId,
      stockUnitId,
      kind: "missing_threshold",
      status: "OPEN",
    },
    data: { status: "RESOLVED" },
  });
  return { ok: true };
}

export async function ignoreCatalogIssue(
  restaurantId: string,
  issueId: string
): Promise<void> {
  await prisma.catalogIssue.updateMany({
    where: { id: issueId, restaurantId },
    data: { status: "IGNORED" },
  });
}
