import type { PrismaClient } from "@prisma/client";

export type RetailImportResult = {
  created: number;
  updated: number;
  skipped: number;
};

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

/** Import catalogue retail depuis CSV (texte). Séparateur ; ou , */
export async function importRetailCatalogCsv(
  restaurantId: string,
  csvText: string,
  db: PrismaClient
): Promise<RetailImportResult> {
  const lines = csvText.split(/\r?\n/);
  let headers: string[] | null = null;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of lines) {
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

    const existingDish = await db.product.findFirst({
      where: {
        restaurantId,
        OR: [{ externalSku: sku }, { name }],
      },
      include: { productStocks: true },
    });

    const existingIngredient = await db.stockUnit.findFirst({
      where: { restaurantId, name },
      orderBy: { createdAt: "asc" },
    });

    if (existingDish) {
      await db.product.updateMany({
        where: { id: existingDish.id, restaurantId },
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
        await db.stockUnit.updateMany({
          where: { id: stockUnitId, restaurantId },
          data: {
            name,
            unit,
            stockTheoretical: stock,
            criticalThreshold: seuil,
            lastPurchasePrice: price || undefined,
          },
        });
        if (!link) {
          await db.productStock.create({
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
      (await db.stockUnit.create({
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
      await db.stockUnit.updateMany({
        where: { id: existingIngredient.id, restaurantId },
        data: {
          unit,
          stockTheoretical: stock,
          criticalThreshold: seuil,
          lastPurchasePrice: price || undefined,
        },
      });
    }

    const dish = await db.product.create({
      data: {
        restaurantId,
        name,
        salePrice: price,
        externalSku: sku,
        active: true,
        foodCost: price || null,
      },
    });

    await db.productStock.create({
      data: {
        productId: dish.id,
        stockUnitId: ingredient.id,
        quantity: 1,
        unit,
      },
    });

    created += 1;
  }

  return { created, updated, skipped };
}
