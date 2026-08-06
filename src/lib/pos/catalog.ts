import { prisma } from "@/lib/db";
import { applyUnitDefaults } from "@/lib/units";
import { normalizePosName } from "@/lib/pos/helpers";
import { normalizeSku, skusEqual } from "@/lib/pos/sku";

export type AcceptPendingResult = {
  accepted: number;
  ingredientIds: string[];
  dishIds: string[];
};

/**
 * Accept pending POS products → Dish + Ingredient 1:1 (shop pattern) with externalSku.
 */
export async function acceptPosPendingProducts(
  restaurantId: string,
  pendingIds: string[]
): Promise<AcceptPendingResult> {
  const pending = await prisma.posPendingProduct.findMany({
    where: {
      restaurantId,
      id: { in: pendingIds },
      status: "PENDING",
    },
  });

  const ingredientIds: string[] = [];
  const dishIds: string[] = [];
  let accepted = 0;

  await prisma.$transaction(async (tx) => {
    for (const p of pending) {
      const name = p.name.trim();
      if (!name) continue;

      const defaults = applyUnitDefaults(name);
      const unit = defaults.unit;

      // Reuse existing ingredient by normalized name if present
      const existingIngredients = await tx.ingredient.findMany({
        where: { restaurantId },
      });
      let ingredient = existingIngredients.find(
        (i) => normalizePosName(i.name) === normalizePosName(name)
      );

      if (!ingredient) {
        ingredient = await tx.ingredient.create({
          data: {
            restaurantId,
            name,
            unit,
            stockTheoretical: 0,
            criticalThreshold: 0,
            reorderQty: defaults.reorderQty,
          },
        });
      }
      ingredientIds.push(ingredient.id);

      const allDishes = await tx.dish.findMany({ where: { restaurantId } });
      const skuNorm = normalizeSku(p.externalSku);
      const existingDish =
        (skuNorm &&
          allDishes.find((d) => skusEqual(d.externalSku, skuNorm))) ||
        allDishes.find((d) => normalizePosName(d.name) === normalizePosName(name));

      let dishId: string;
      if (existingDish) {
        dishId = existingDish.id;
        await tx.dish.update({
          where: { id: existingDish.id },
          data: {
            externalSku: skuNorm || existingDish.externalSku,
            salePrice:
              p.lastUnitPrice != null && p.lastUnitPrice > 0
                ? p.lastUnitPrice
                : existingDish.salePrice,
            active: true,
          },
        });
        const link = await tx.recipeIngredient.findFirst({
          where: { dishId: existingDish.id, ingredientId: ingredient.id },
        });
        if (!link) {
          await tx.recipeIngredient.create({
            data: {
              dishId: existingDish.id,
              ingredientId: ingredient.id,
              quantity: 1,
              unit,
            },
          });
        }
      } else {
        const dish = await tx.dish.create({
          data: {
            restaurantId,
            name,
            salePrice: p.lastUnitPrice != null && p.lastUnitPrice > 0 ? p.lastUnitPrice : 0,
            externalSku: skuNorm,
            active: true,
            ingredients: {
              create: [
                {
                  ingredientId: ingredient.id,
                  quantity: 1,
                  unit,
                },
              ],
            },
          },
        });
        dishId = dish.id;
      }

      dishIds.push(dishId);

      await tx.posPendingProduct.update({
        where: { id: p.id },
        data: { status: "ACCEPTED" },
      });
      accepted += 1;
    }
  });

  return { accepted, ingredientIds, dishIds };
}

export async function ignorePosPendingProducts(
  restaurantId: string,
  pendingIds: string[]
) {
  await prisma.posPendingProduct.updateMany({
    where: {
      restaurantId,
      id: { in: pendingIds },
      status: "PENDING",
    },
    data: { status: "IGNORED" },
  });
}
