import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatKitchenQty } from "@/lib/units";
import { formatQty } from "@/lib/stock-engine";
import { StockWorkspace } from "@/components/stock/StockWorkspace";
import { syncCatalogIssues } from "@/lib/catalog/issues";
import { requireFranchiseSession } from "../../../../actions";

export default async function FranchiseStockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFranchiseSession();
  const { id: rid } = await params;

  await syncCatalogIssues(rid).catch(() => null);

  const [ingredients, dishes, restaurant, catalogIssues] = await Promise.all([
    prisma.stockUnit.findMany({
      where: { restaurantId: rid },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { restaurantId: rid },
      include: { productStocks: { include: { stockUnit: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.restaurant.findUniqueOrThrow({ where: { id: rid } }),
    prisma.catalogIssue.findMany({
      where: { restaurantId: rid, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ]);

  const critical = ingredients.filter(
    (i) =>
      i.criticalThreshold > 0 && i.stockTheoretical <= i.criticalThreshold
  );

  const sheetRows = ingredients.map((ing) => ({
    id: ing.id,
    name: ing.name,
    unit: ing.unit,
    stockTheoretical: ing.stockTheoretical,
    criticalThreshold: ing.criticalThreshold,
    reorderQty: ing.reorderQty,
    stockLabel: formatKitchenQty(ing.stockTheoretical, ing.unit, ing.name),
    thresholdLabel: formatKitchenQty(
      ing.criticalThreshold,
      ing.unit,
      ing.name
    ),
    reorderLabel: formatKitchenQty(ing.reorderQty, ing.unit, ing.name),
    critical:
      ing.criticalThreshold > 0 &&
      ing.stockTheoretical <= ing.criticalThreshold,
  }));

  return (
    <div className="franchise-page">
      <header className="franchise-page-head">
        <p className="franchise-page-head__eyebrow">{restaurant.name}</p>
        <h1>Stock</h1>
        <p className="franchise-page-head__lead">
          {critical.length > 0
            ? `${critical.length} sous seuil`
            : `${ingredients.length} produit(s)`}
        </p>
      </header>

      <p className="franchise-store-row__meta" style={{ marginBottom: "1rem" }}>
        <Link href={`/franchise/s/${rid}/orders`}>Courses →</Link>
      </p>

      <Suspense fallback={<p>Chargement…</p>}>
        <StockWorkspace
          restaurantName={restaurant.name}
          whatsappTo={restaurant.whatsappTo}
          sheetRows={sheetRows}
          critical={critical.map((c) => ({
            name: c.name,
            unit: c.unit,
            stockTheoretical: c.stockTheoretical,
            criticalThreshold: c.criticalThreshold,
          }))}
          productCount={ingredients.length}
          catalogOpenCount={catalogIssues.length}
          catalogIssues={catalogIssues.map((i) => ({
            id: i.id,
            kind: i.kind,
            title: i.title,
            detail: i.detail,
            stockUnitId: i.stockUnitId,
            stockUnitIdB: i.stockUnitIdB,
            productId: i.productId,
          }))}
          dishes={dishes.map((dish) => ({
            id: dish.id,
            name: dish.name,
            description: dish.description,
            allergens: dish.allergens,
            imageUrl: dish.imageUrl,
            salePrice: dish.salePrice,
            externalSku: dish.externalSku,
            recipeLines: dish.productStocks.map((ri) => ({
              name: ri.stockUnit.name,
              qtyLabel: formatQty(ri.quantity, ri.unit),
            })),
            ingredientsLabel: dish.productStocks
              .map(
                (ri) =>
                  `${ri.stockUnit.name} ${formatQty(ri.quantity, ri.unit)}`
              )
              .join(" · "),
          }))}
          ingredientOptions={ingredients.map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
          }))}
        />
      </Suspense>
    </div>
  );
}
