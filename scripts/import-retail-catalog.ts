/**
 * Import retail : 1 ligne CSV → StockUnit + Product + ProductStock (qty 1).
 *
 * Usage:
 *   npx tsx scripts/import-retail-catalog.ts \
 *     --restaurant-id cmskq1m4l0000je5l96lv1tjo \
 *     --csv tmp-pilot-stock.csv
 *
 * CSV attendu (séparateur ; ou ,) :
 *   Nom;Stock;Seuil;Unite;Prix
 *   Lait entier;12;6;L;1.20
 *
 * Colonne SKU optionnelle : Sku / SKU / Code
 * Si absente → SKU dérivé du nom (slug majuscules).
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

function splitCsvLine(line: string): string[] {
  const sep = line.includes(";") ? ";" : ",";
  return line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
}

function skuFromName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return slug || `SKU-${Date.now().toString(36).toUpperCase()}`;
}

function headerIndex(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (const a of aliases) {
    const i = lower.indexOf(a.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

async function main() {
  const restaurantId = arg("--restaurant-id");
  const csvPath = arg("--csv");
  if (!restaurantId || !csvPath) {
    console.error(
      `Usage: npx tsx scripts/import-retail-catalog.ts --restaurant-id <id> --csv <file.csv>`
    );
    process.exit(1);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true },
  });
  if (!restaurant) {
    console.error(`Restaurant introuvable: ${restaurantId}`);
    process.exit(1);
  }

  const rl = createInterface({
    input: createReadStream(csvPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let headers: string[] | null = null;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for await (const raw of rl) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const cols = splitCsvLine(line);
    if (!headers) {
      headers = cols;
      continue;
    }

    const iName = headerIndex(headers, ["Nom", "Name", "Produit", "Article"]);
    const iStock = headerIndex(headers, ["Stock", "Qty", "Quantite", "Quantité"]);
    const iSeuil = headerIndex(headers, ["Seuil", "Threshold", "Critique"]);
    const iUnit = headerIndex(headers, ["Unite", "Unité", "Unit"]);
    const iPrice = headerIndex(headers, ["Prix", "Price", "SalePrice"]);
    const iSku = headerIndex(headers, ["Sku", "SKU", "Code", "EAN", "Barcode"]);

    const name = (iName >= 0 ? cols[iName] : cols[0] || "").trim();
    if (!name) {
      skipped += 1;
      continue;
    }

    const stock = Number(iStock >= 0 ? cols[iStock] : 0) || 0;
    const seuil = Number(iSeuil >= 0 ? cols[iSeuil] : 0) || 0;
    const unit = ((iUnit >= 0 ? cols[iUnit] : "u") || "u").trim() || "u";
    const price = Number(iPrice >= 0 ? cols[iPrice] : 0) || 0;
    const skuRaw = (iSku >= 0 ? cols[iSku] : "").trim();
    const sku = skuRaw || skuFromName(name);

    const existingDish = await prisma.product.findFirst({
      where: {
        restaurantId,
        OR: [{ externalSku: sku }, { name }],
      },
      include: { productStocks: true },
    });

    const existingIngredient = await prisma.stockUnit.findFirst({
      where: { restaurantId, name },
      orderBy: { createdAt: "asc" },
    });

    if (existingDish) {
      await prisma.product.update({
        where: { id: existingDish.id },
        data: {
          name,
          externalSku: sku,
          salePrice: price || existingDish.salePrice,
          active: true,
        },
      });
      const link = existingDish.productStocks[0];
      const stockUnitId = link?.stockUnitId || existingIngredient?.id;
      if (stockUnitId) {
        await prisma.stockUnit.update({
          where: { id: stockUnitId },
          data: {
            name,
            unit,
            stockTheoretical: stock,
            criticalThreshold: seuil,
            lastPurchasePrice: price || undefined,
          },
        });
        if (!link) {
          await prisma.productStock.create({
            data: {
              productId: existingDish.id,
              stockUnitId,
              quantity: 1,
              unit,
            },
          });
        }
      }
      updated += 1;
      continue;
    }

    const ingredient =
      existingIngredient ||
      (await prisma.stockUnit.create({
        data: {
          restaurantId,
          name,
          unit,
          stockTheoretical: stock,
          criticalThreshold: seuil,
          reorderQty: Math.max(seuil, 0),
          lastPurchasePrice: price || null,
          category: "epicerie",
        },
      }));

    if (existingIngredient) {
      await prisma.stockUnit.update({
        where: { id: existingIngredient.id },
        data: {
          unit,
          stockTheoretical: stock,
          criticalThreshold: seuil,
          lastPurchasePrice: price || undefined,
        },
      });
    }

    const dish = await prisma.product.create({
      data: {
        restaurantId,
        name,
        salePrice: price,
        externalSku: sku,
        active: true,
        foodCost: price || null,
      },
    });

    await prisma.productStock.create({
      data: {
        productId: dish.id,
        stockUnitId: ingredient.id,
        quantity: 1,
        unit,
      },
    });

    created += 1;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        restaurant: restaurant.name,
        restaurantId,
        created,
        updated,
        skipped,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
