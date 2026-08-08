/**
 * Purge tous les users sauf le fondateur (+ leur restaurant).
 * Usage:
 *   npx tsx scripts/purge-non-founder-users.ts
 * Préfère .env.local (Neon) à .env (Docker local).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(name: string, override = false) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (override || !process.env[m[1]]) process.env[m[1]] = v;
  }
}

// Avant tout import Prisma (sinon .env localhost écrase Neon)
loadEnvFile(".env");
loadEnvFile(".env.local", true);

const FOUNDER_EMAIL = (process.env.FOUNDER_EMAIL || "reeegency@gmail.com")
  .trim()
  .toLowerCase();

type UserRow = { email: string; id: string; restaurantId: string };

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const host = (() => {
      try {
        return new URL(process.env.DATABASE_URL || "").hostname;
      } catch {
        return "?";
      }
    })();
    console.log(`DB host: ${host}`);
    console.log(`Founder email: ${FOUNDER_EMAIL}`);

    const users = await prisma.$queryRaw<UserRow[]>`
      SELECT email, id, "restaurantId" FROM "User"
    `;

    const totalBefore = users.length;
    console.log(`\nTotal users: ${totalBefore}`);
    for (const u of users) {
      console.log(`  - ${u.email} (id=${u.id}, restaurantId=${u.restaurantId})`);
    }

    const founder = users.find(
      (u) => u.email.trim().toLowerCase() === FOUNDER_EMAIL
    );
    if (!founder) {
      console.error(
        `\nABORT — founder user not found: ${FOUNDER_EMAIL}. No deletes performed.`
      );
      process.exit(1);
    }

    const toDelete = users.filter((u) => u.id !== founder.id);
    console.log(`\nWill delete: ${toDelete.length} user(s)`);
    console.log(`Will keep: 1 (${founder.email})`);
    if (toDelete.length) {
      console.log("Emails to delete:");
      for (const u of toDelete) console.log(`  - ${u.email}`);
    }

    const otherRestaurantIds = [
      ...new Set(
        toDelete
          .map((u) => u.restaurantId)
          .filter((id) => id !== founder.restaurantId)
      ),
    ];

    if (otherRestaurantIds.length) {
      const ids = otherRestaurantIds;
      console.log(`\nClearing dependents for ${ids.length} restaurant(s)…`);

      // Lines with Restrict on Ingredient / diamond FKs — must go before restaurant cascade.
      const steps: Array<[string, () => Promise<{ count: number }>]> = [
        [
          "SaleItem",
          () =>
            prisma.saleItem.deleteMany({
              where: { sale: { restaurantId: { in: ids } } },
            }),
        ],
        [
          "RecipeIngredient",
          () =>
            prisma.recipeIngredient.deleteMany({
              where: { dish: { restaurantId: { in: ids } } },
            }),
        ],
        [
          "SupplierCatalogItem",
          () =>
            prisma.supplierCatalogItem.deleteMany({
              where: { supplier: { restaurantId: { in: ids } } },
            }),
        ],
        [
          "PurchaseOrderLine",
          () =>
            prisma.purchaseOrderLine.deleteMany({
              where: { order: { restaurantId: { in: ids } } },
            }),
        ],
        [
          "SupplierReceiptLine",
          () =>
            prisma.supplierReceiptLine.deleteMany({
              where: { receipt: { restaurantId: { in: ids } } },
            }),
        ],
        [
          "InventoryCountLine",
          () =>
            prisma.inventoryCountLine.deleteMany({
              where: { inventoryCount: { restaurantId: { in: ids } } },
            }),
        ],
        [
          "StockMovement",
          () =>
            prisma.stockMovement.deleteMany({
              where: { restaurantId: { in: ids } },
            }),
        ],
        [
          "IngredientPriceEvent",
          () =>
            prisma.ingredientPriceEvent.deleteMany({
              where: { restaurantId: { in: ids } },
            }),
        ],
        [
          "PurchaseOrder",
          () =>
            prisma.purchaseOrder.deleteMany({
              where: { restaurantId: { in: ids } },
            }),
        ],
        [
          "SupplierReceipt",
          () =>
            prisma.supplierReceipt.deleteMany({
              where: { restaurantId: { in: ids } },
            }),
        ],
      ];

      for (const [label, run] of steps) {
        const r = await run();
        console.log(`  ${label}: ${r.count}`);
      }

      const deletedRestaurants = await prisma.restaurant.deleteMany({
        where: { id: { in: ids } },
      });
      console.log(
        `Deleted restaurants (non-founder): ${deletedRestaurants.count}`
      );
    } else {
      console.log("\nNo non-founder restaurants to delete.");
    }

    // Leftover users sharing founder restaurant (except founder).
    const leftover = await prisma.$queryRaw<UserRow[]>`
      SELECT email, id, "restaurantId" FROM "User"
      WHERE id != ${founder.id}
    `;
    if (leftover.length) {
      const deletedUsers = await prisma.user.deleteMany({
        where: { id: { in: leftover.map((u) => u.id) } },
      });
      console.log(
        `Deleted leftover users on founder restaurant: ${deletedUsers.count}`
      );
    }

    const otpDeleted = await prisma.signupOtpChallenge.deleteMany({
      where: {
        NOT: {
          email: {
            equals: FOUNDER_EMAIL,
            mode: "insensitive",
          },
        },
      },
    });
    console.log(`Deleted SignupOtpChallenge rows: ${otpDeleted.count}`);

    const remaining = await prisma.$queryRaw<UserRow[]>`
      SELECT email, id, "restaurantId" FROM "User"
    `;
    console.log(`\nFinal user count: ${remaining.length}`);
    console.log("Remaining email(s):");
    for (const u of remaining) console.log(`  - ${u.email}`);

    console.log("\n--- SUMMARY ---");
    console.log(`TOTAL_BEFORE=${totalBefore}`);
    console.log(
      `EMAILS_DELETED=${JSON.stringify(toDelete.map((u) => u.email))}`
    );
    console.log(
      `EMAILS_KEPT=${JSON.stringify(remaining.map((u) => u.email))}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(String(e?.message || e).slice(0, 800));
  process.exit(1);
});
