import { prisma } from "@/lib/db";
import { applyUnitDefaults } from "@/lib/units";
import { normalizePosName } from "@/lib/pos/helpers";
import { normalizeSku, skusEqual } from "@/lib/pos/sku";

export type AcceptPendingResult = {
  accepted: number;
  stockUnitIds: string[];
  productIds: string[];
};

/**
 * Accept pending POS products → Product + StockUnit 1:1 (shop pattern) with externalSku.
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

  const stockUnitIds: string[] = [];
  const productIds: string[] = [];
  let accepted = 0;

  await prisma.$transaction(async (tx) => {
    for (const p of pending) {
      const name = p.name.trim();
      if (!name) continue;

      const defaults = applyUnitDefaults(name);
      const unit = defaults.unit;

      // Reuse existing ingredient by normalized name if present
      const existingIngredients = await tx.stockUnit.findMany({
        where: { restaurantId },
      });
      let ingredient = existingIngredients.find(
        (i) => normalizePosName(i.name) === normalizePosName(name)
      );

      if (!ingredient) {
        ingredient = await tx.stockUnit.create({
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
      stockUnitIds.push(ingredient.id);

      const allDishes = await tx.product.findMany({ where: { restaurantId } });
      const skuNorm = normalizeSku(p.externalSku);
      const existingDish =
        (skuNorm &&
          allDishes.find((d) => skusEqual(d.externalSku, skuNorm))) ||
        allDishes.find((d) => normalizePosName(d.name) === normalizePosName(name));

      let productId: string;
      if (existingDish) {
        productId = existingDish.id;
        await tx.product.update({
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
        const link = await tx.productStock.findFirst({
          where: { productId: existingDish.id, stockUnitId: ingredient.id },
        });
        if (!link) {
          await tx.productStock.create({
            data: {
              productId: existingDish.id,
              stockUnitId: ingredient.id,
              quantity: 1,
              unit,
            },
          });
        }
      } else {
        const dish = await tx.product.create({
          data: {
            restaurantId,
            name,
            salePrice: p.lastUnitPrice != null && p.lastUnitPrice > 0 ? p.lastUnitPrice : 0,
            externalSku: skuNorm,
            active: true,
            productStocks: { create: [
                {
                  stockUnitId: ingredient.id,
                  quantity: 1,
                  unit,
                },
              ],
            },
          },
        });
        productId = dish.id;
      }

      productIds.push(productId);

      await tx.posPendingProduct.update({
        where: { id: p.id },
        data: { status: "ACCEPTED" },
      });
      accepted += 1;
    }
  });

  return { accepted, stockUnitIds, productIds };
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
