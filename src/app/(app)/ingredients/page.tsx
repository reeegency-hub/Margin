import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatKitchenQty } from "@/lib/units";
import { formatQty } from "@/lib/stock-engine";
import { BrandPage } from "@/components/brand/BrandCard";
import { StockWorkspace } from "@/components/stock/StockWorkspace";
import { syncCatalogIssues } from "@/lib/catalog/issues";

export default async function IngredientsPage() {
  const session = await requireSession();
  const rid = session.user.restaurantId;

  await syncCatalogIssues(rid).catch(() => null);

  const [ingredients, dishes, restaurant, catalogIssues] = await Promise.all([
    prisma.ingredient.findMany({
      where: { restaurantId: rid },
      orderBy: { name: "asc" },
    }),
    prisma.dish.findMany({
      where: { restaurantId: rid },
      include: { ingredients: { include: { ingredient: true } } },
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
    <BrandPage
      question="Stock"
      guide="Quantités en magasin — si ça ne colle pas, vérification."
    >
      <Suspense
        fallback={
          <p className="text-[14px] text-[var(--text-secondary-light)]">
            Chargement…
          </p>
        }
      >
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
            ingredientId: i.ingredientId,
            ingredientIdB: i.ingredientIdB,
            dishId: i.dishId,
          }))}
          dishes={dishes.map((dish) => ({
            id: dish.id,
            name: dish.name,
            description: dish.description,
            allergens: dish.allergens,
            imageUrl: dish.imageUrl,
            salePrice: dish.salePrice,
            externalSku: dish.externalSku,
            recipeLines: dish.ingredients.map((ri) => ({
              name: ri.ingredient.name,
              qtyLabel: formatQty(ri.quantity, ri.unit),
            })),
            ingredientsLabel: dish.ingredients
              .map(
                (ri) =>
                  `${ri.ingredient.name} ${formatQty(ri.quantity, ri.unit)}`
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
    </BrandPage>
  );
}
