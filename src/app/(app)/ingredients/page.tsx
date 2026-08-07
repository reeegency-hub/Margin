import { Suspense } from "react";
import Link from "next/link";
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

  const inkTitle =
    ingredients.length === 0
      ? "Aucun produit"
      : critical.length > 0
        ? `${critical.length} sous seuil`
        : catalogIssues.length > 0
          ? `${catalogIssues.length} à nettoyer`
          : "Stock sous contrôle";

  const inkDetail =
    ingredients.length === 0
      ? "Ajoutez des produits ou branchez la caisse pour découvrir le catalogue."
      : critical.length > 0
        ? `${critical[0]!.name}${
            critical.length > 1 ? ` et ${critical.length - 1} autre(s)` : ""
          } — ouvrez Courses, puis vérifiez le rayon si besoin.`
        : catalogIssues.length > 0
          ? "Doublons ou fiches à corriger dans l’onglet Qualité."
          : `${ingredients.length} produit${
              ingredients.length > 1 ? "s" : ""
            } · rien d’urgent.`;

  return (
    <BrandPage
      question="Stock"
      guide="Quantités en magasin — si ça ne colle pas, vérification."
    >
      <div className="dash-card dash-card--dark hub-now">
        <p className="hub-now__eyebrow">À faire maintenant</p>
        <p className="hub-now__title">{inkTitle}</p>
        <p className="hub-now__detail">{inkDetail}</p>
        <div className="hub-now__actions">
          {ingredients.length === 0 ? (
            <Link href="/kiosks" className="btn-lime">
              Brancher la caisse
            </Link>
          ) : null}
          {critical.length > 0 ? (
            <Link href="/orders" className="btn-lime">
              Ouvrir les courses
            </Link>
          ) : null}
          {critical.length > 0 || ingredients.length > 0 ? (
            <Link
              href="/inventory"
              className={critical.length > 0 ? "btn-ghost" : "btn-lime"}
            >
              Vérifier le rayon
            </Link>
          ) : null}
        </div>
      </div>

      <p className="hub-secondary-link">
        <Link href="/orders">Courses →</Link>
        {" · "}
        <Link href="/inventory">Vérification →</Link>
      </p>

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
