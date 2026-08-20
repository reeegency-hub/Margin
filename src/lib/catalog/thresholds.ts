/**
 * Seuils de réassort par défaut — catégorie + vélocité.
 */
import { prisma } from "@/lib/db";
import { inferCategory } from "@/lib/catalog/normalize";
import {
  applyUnitDefaults,
  suggestReorderQty,
  suggestThreshold,
  type StorageUnit,
} from "@/lib/units";
import { avgDailyConsumption } from "@/lib/stock-engine";

/** Jours de couverture pour seuil vélocité. */
const VELOCITY_COVER_DAYS = 2;
const VELOCITY_REORDER_DAYS = 7;
/** Minimum de jours d’historique avant recalcul auto. */
const MIN_HISTORY_DAYS = 14;

export function defaultThresholdForIngredient(name: string, unit: string): {
  criticalThreshold: number;
  reorderQty: number;
  category: string;
  thresholdSource: "unit_default";
} {
  const u = (["g", "ml", "pcs"].includes(unit) ? unit : "g") as StorageUnit;
  const category = inferCategory(name);
  // Affinage léger par catégorie
  let critical = suggestThreshold(u, name);
  let reorder = suggestReorderQty(u, name);
  if (category === "epicerie") {
    critical = Math.round(critical * 0.7);
    reorder = Math.round(reorder * 1.2);
  } else if (category === "frais" || category === "piece") {
    critical = Math.round(critical * 1.2);
  } else if (category === "liquide") {
    critical = Math.max(critical, suggestThreshold("ml", name));
  }
  return {
    criticalThreshold: critical,
    reorderQty: reorder,
    category,
    thresholdSource: "unit_default",
  };
}

/** Applique des seuils unit_default aux ingrédients encore à 0 (post-import). */
export async function seedDefaultThresholds(
  restaurantId: string,
  opts?: { onlyZero?: boolean }
): Promise<number> {
  const onlyZero = opts?.onlyZero !== false;
  const ingredients = await prisma.stockUnit.findMany({
    where: {
      restaurantId,
      ...(onlyZero ? { criticalThreshold: 0 } : {}),
      OR: [{ thresholdSource: null }, { thresholdSource: "none" }],
    },
  });

  let updated = 0;
  for (const ing of ingredients) {
    const d = defaultThresholdForIngredient(ing.name, ing.unit);
    await prisma.stockUnit.updateMany({
      where: { id: ing.id, restaurantId },
      data: {
        criticalThreshold: d.criticalThreshold,
        reorderQty: ing.reorderQty > 0 ? ing.reorderQty : d.reorderQty,
        category: d.category,
        thresholdSource: d.thresholdSource,
      },
    });
    updated += 1;
  }
  return updated;
}

/**
 * Recalcule les seuils selon la vélocité réelle (après ~2–3 semaines).
 * Ne touche pas les seuils `manual`.
 */
export async function refreshVelocityThresholds(
  restaurantId: string
): Promise<{ updated: number; skipped: number }> {
  const since = new Date(Date.now() - MIN_HISTORY_DAYS * 86400000);
  const ingredients = await prisma.stockUnit.findMany({
    where: {
      restaurantId,
      OR: [
        { thresholdSource: null },
        { thresholdSource: "none" },
        { thresholdSource: "unit_default" },
        { thresholdSource: "velocity" },
        { criticalThreshold: 0 },
      ],
    },
    take: 200,
  });

  let updated = 0;
  let skipped = 0;

  for (const ing of ingredients) {
    if (ing.thresholdSource === "manual") {
      skipped += 1;
      continue;
    }

    const firstSale = await prisma.stockMovement.findFirst({
      where: {
        restaurantId,
        stockUnitId: ing.id,
        type: "SALE",
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (!firstSale || firstSale.createdAt > since) {
      skipped += 1;
      continue;
    }

    const avg = await avgDailyConsumption(restaurantId, ing.id);
    if (!(avg > 0)) {
      skipped += 1;
      continue;
    }

    const critical = Math.max(1, Math.ceil(avg * VELOCITY_COVER_DAYS));
    const reorder = Math.max(critical * 2, Math.ceil(avg * VELOCITY_REORDER_DAYS));

    await prisma.stockUnit.updateMany({
      where: { id: ing.id, restaurantId },
      data: {
        criticalThreshold: critical,
        reorderQty: reorder,
        thresholdSource: "velocity",
        category: ing.category || inferCategory(ing.name),
      },
    });
    updated += 1;
  }

  return { updated, skipped };
}

export { applyUnitDefaults };
