/**
 * Integration test: sale → stock decrement → alert + pending stock recap → receipt resolves.
 * Requires seeded DB. Run: npx tsx scripts/test-loop.ts
 */
import { PrismaClient } from "@prisma/client";
import { recordSale, recordReceipt } from "../src/lib/stock-engine";
import { StockAlertService } from "../src/lib/stock-alert-service";

const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.findFirstOrThrow();
  const tomate = await prisma.ingredient.findFirstOrThrow({
    where: { restaurantId: restaurant.id, name: "Tomate" },
  });
  const dish = await prisma.dish.findFirstOrThrow({
    where: { restaurantId: restaurant.id, name: "Burger Signature" },
    include: { ingredients: true },
  });

  await prisma.ingredient.update({
    where: { id: tomate.id },
    data: { stockTheoretical: 100, criticalThreshold: 1500 },
  });
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      pendingStockRecapJson: null,
      pendingStockRecapStatus: null,
      pendingStockRecapKey: null,
      pendingStockRecapAt: null,
    },
  });

  const before = await prisma.ingredient.findUniqueOrThrow({
    where: { id: tomate.id },
  });

  await recordSale(restaurant.id, [{ dishId: dish.id, quantity: 1 }]);

  const afterSale = await prisma.ingredient.findUniqueOrThrow({
    where: { id: tomate.id },
  });
  const expected = before.stockTheoretical - 40; // burger uses 40g tomate
  if (Math.abs(afterSale.stockTheoretical - expected) > 0.01) {
    throw new Error(
      `Stock mismatch: got ${afterSale.stockTheoretical}, expected ${expected}`
    );
  }

  const alert = await prisma.alert.findFirst({
    where: {
      restaurantId: restaurant.id,
      ingredientId: tomate.id,
      status: "ACTIVE",
      type: "STOCK_CRITICAL",
    },
  });
  if (!alert) throw new Error("Expected STOCK_CRITICAL alert");

  const pending = await StockAlertService.getPending(restaurant.id);
  if (!pending || pending.summary.nombre_produits < 1) {
    throw new Error("Expected pending StockAlertSummary after sale");
  }
  const tomateLine = pending.summary.liste.find(
    (l) => l.ingredientId === tomate.id
  );
  if (!tomateLine || tomateLine.quantite_a_commander <= 0) {
    throw new Error("Expected recommended qty for Tomate in recap");
  }

  const supplier = await prisma.supplier.findFirstOrThrow({
    where: { restaurantId: restaurant.id },
  });

  await recordReceipt(restaurant.id, supplier.id, [
    { ingredientId: tomate.id, quantity: 5000 },
  ]);

  const afterReceipt = await prisma.ingredient.findUniqueOrThrow({
    where: { id: tomate.id },
  });
  if (afterReceipt.stockTheoretical <= afterReceipt.criticalThreshold) {
    throw new Error("Stock should be above threshold after receipt");
  }

  const resolved = await prisma.alert.findFirst({
    where: { id: alert.id, status: "RESOLVED" },
  });
  if (!resolved) throw new Error("Alert should be resolved after receipt");

  const pendingAfter = await StockAlertService.getPending(restaurant.id);
  // Tomate no longer critical; other seed criticals may remain
  if (pendingAfter) {
    const stillTomate = pendingAfter.summary.liste.some(
      (l) => l.ingredientId === tomate.id
    );
    if (stillTomate) {
      throw new Error("Tomate should not remain in pending recap");
    }
  }

  console.log(
    "test-loop.ts — OK (vente → alerte + récap → réception → résolution)"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
