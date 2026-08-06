/**
 * Santé catalogue par tenant — priorisation Ops.
 */
import { prisma } from "@/lib/db";

export type CatalogHealth = {
  restaurantId: string;
  score: number; // 0–100
  grade: "A" | "B" | "C" | "D";
  ingredientCount: number;
  dishCount: number;
  withoutThresholdPct: number;
  withoutThreshold: number;
  openDuplicates: number;
  openIssues: number;
  zeroPriceDishes: number;
  stalePriceDishes: number;
  missingThresholdWithSales: number;
  risk: "low" | "medium" | "high";
  headline: string;
};

export async function getCatalogHealth(
  restaurantId: string
): Promise<CatalogHealth> {
  const staleBefore = new Date(Date.now() - 90 * 86400000);

  const [
    ingredientCount,
    dishCount,
    withoutThreshold,
    openIssues,
    openDuplicates,
    zeroPriceDishes,
    stalePriceDishes,
    missingThresholdWithSales,
  ] = await Promise.all([
    prisma.ingredient.count({ where: { restaurantId } }),
    prisma.dish.count({ where: { restaurantId } }),
    prisma.ingredient.count({
      where: { restaurantId, criticalThreshold: { lte: 0 } },
    }),
    prisma.catalogIssue.count({
      where: { restaurantId, status: "OPEN" },
    }),
    prisma.catalogIssue.count({
      where: {
        restaurantId,
        status: "OPEN",
        kind: { in: ["duplicate_ingredient", "duplicate_dish"] },
      },
    }),
    prisma.dish.count({
      where: { restaurantId, salePrice: { lte: 0 } },
    }),
    prisma.dish.count({
      where: { restaurantId, updatedAt: { lt: staleBefore }, salePrice: { gt: 0 } },
    }),
    prisma.catalogIssue.count({
      where: {
        restaurantId,
        status: "OPEN",
        kind: "missing_threshold",
      },
    }),
  ]);

  const withoutThresholdPct =
    ingredientCount > 0
      ? Math.round((withoutThreshold / ingredientCount) * 1000) / 10
      : 0;

  // Score 100 → pénalités
  let score = 100;
  if (ingredientCount === 0 && dishCount === 0) {
    score = 40;
  } else {
    score -= Math.min(40, withoutThresholdPct * 0.4);
    score -= Math.min(20, openDuplicates * 5);
    score -= Math.min(15, zeroPriceDishes * 3);
    score -= Math.min(10, stalePriceDishes * 1);
    score -= Math.min(15, missingThresholdWithSales * 4);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade: CatalogHealth["grade"] =
    score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";
  const risk: CatalogHealth["risk"] =
    grade === "A" || grade === "B"
      ? "low"
      : grade === "C"
        ? "medium"
        : "high";

  const headline =
    ingredientCount === 0
      ? "Catalogue vide — prioriser l’import"
      : risk === "high"
        ? `Santé faible (${score}) — seuils / doublons à traiter`
        : risk === "medium"
          ? `Santé moyenne (${score}) — relance utile`
          : `Catalogue sain (${score})`;

  return {
    restaurantId,
    score,
    grade,
    ingredientCount,
    dishCount,
    withoutThresholdPct,
    withoutThreshold,
    openDuplicates,
    openIssues,
    zeroPriceDishes,
    stalePriceDishes,
    missingThresholdWithSales,
    risk,
    headline,
  };
}

export async function getCatalogHealthForStores(
  restaurantIds: string[]
): Promise<Map<string, CatalogHealth>> {
  const map = new Map<string, CatalogHealth>();
  // Sequential ok for admin (~dozens of stores)
  for (const id of restaurantIds) {
    map.set(id, await getCatalogHealth(id));
  }
  return map;
}
