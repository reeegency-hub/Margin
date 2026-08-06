import { avgDailyConsumption } from "@/lib/stock-engine";

export type ForecastInput = {
  stockTheoretical: number;
  criticalThreshold: number;
  reorderQty: number;
  /** Average daily consumption (absolute units). */
  avgDaily: number;
  /** Days of cover to target when restocking (default 3). */
  coverDays?: number;
};

/**
 * ForecastService — quantité recommandée à commander.
 * Combine réappro configuré, déficit vs seuil, et couverture sur X jours.
 */
export class ForecastService {
  static recommendQty(input: ForecastInput): number {
    const coverDays = input.coverDays ?? 3;
    const deficit = Math.max(
      0,
      input.criticalThreshold - input.stockTheoretical
    );
    const cover = Math.max(0, input.avgDaily * coverDays);
    const configured = Math.max(0, input.reorderQty);
    const raw = Math.max(configured, deficit + cover, cover);
    if (raw <= 0) {
      return Math.max(configured, input.criticalThreshold || 1);
    }
    // Round sensibly for kitchen units
    if (raw >= 100) return Math.ceil(raw / 10) * 10;
    if (raw >= 10) return Math.ceil(raw);
    return Math.max(1, Math.ceil(raw * 10) / 10);
  }

  static async recommendForIngredient(
    restaurantId: string,
    ingredient: {
      id: string;
      stockTheoretical: number;
      criticalThreshold: number;
      reorderQty: number;
    }
  ): Promise<number> {
    const avgDaily = await avgDailyConsumption(restaurantId, ingredient.id);
    return ForecastService.recommendQty({
      stockTheoretical: ingredient.stockTheoretical,
      criticalThreshold: ingredient.criticalThreshold,
      reorderQty: ingredient.reorderQty,
      avgDaily,
    });
  }
}
