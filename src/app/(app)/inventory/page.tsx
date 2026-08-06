import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { BrandPage } from "@/components/brand/BrandCard";
import { startInventory } from "@/app/actions";
import { formatKitchenQty } from "@/lib/units";

export default async function InventoryListPage({
  searchParams,
}: {
  searchParams: Promise<{ validated?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const rid = session.user.restaurantId;

  const [inventories, ingredients] = await Promise.all([
    prisma.inventoryCount.findMany({
      where: { restaurantId: rid },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.ingredient.findMany({
      where: { restaurantId: rid },
      orderBy: { name: "asc" },
    }),
  ]);

  const draft = inventories.find((i) => i.status === "DRAFT");
  const history = inventories.filter((i) => i.id !== draft?.id);
  const critical = ingredients.filter(
    (i) =>
      i.criticalThreshold > 0 && i.stockTheoretical <= i.criticalThreshold
  );

  return (
    <BrandPage question="Vérification" guide="Vérifiez le rayon, puis validez.">
      {params.validated ? <p className="flash">Stock corrigé.</p> : null}

      <section
        className={`dash-card dash-card--dark count-hub${draft ? " count-hub--active" : ""}`}
      >
        <div className="count-hub__top">
          <span className="count-hub__badge">
            {draft ? "En cours" : "Prêt"}
          </span>
          {draft ? (
            <span className="count-hub__meta">
              {draft.lines.length} produit
              {draft.lines.length > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>

        <h2 className="count-hub__title">
          {draft ? "Reprendre" : "Compter le rayon"}
        </h2>

        {critical.length > 0 ? (
          <ul className="count-hub__priority" aria-label="À vérifier d’abord">
            {critical.slice(0, 5).map((i) => (
              <li key={i.id}>
                <span className="count-hub__dot" aria-hidden />
                <Link href={`/ingredients?highlight=${i.id}`}>
                  <strong>{i.name}</strong>
                </Link>
                <em>
                  {formatKitchenQty(i.stockTheoretical, i.unit, i.name)}
                </em>
              </li>
            ))}
            {critical.length > 5 ? (
              <li className="count-hub__more">
                +{critical.length - 5} autres sous seuil
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="count-hub__hint">
            Indiquez ce qu’il y a vraiment. Valider corrige le stock.
          </p>
        )}

        <div className="count-hub__cta">
          {draft ? (
            <Link href={`/inventory/${draft.id}`} className="count-hub__btn">
              Continuer
            </Link>
          ) : (
            <form action={startInventory} className="count-hub__form">
              <button type="submit" className="count-hub__btn">
                Commencer
              </button>
            </form>
          )}
          <Link href="/ingredients" className="count-hub__link">
            Voir le stock
          </Link>
        </div>
      </section>

      {history.length > 0 ? (
        <section className="dash-card dash-card--light count-history" aria-label="Historique">
          <p className="count-history__label">Dernières vérifications</p>
          <ul className="count-history__list">
            {history.map((inv) => {
              const done = inv.status === "VALIDATED";
              return (
                <li key={inv.id}>
                  <Link href={`/inventory/${inv.id}`} className="count-history__row">
                    <span
                      className={`count-history__status${
                        done ? " is-done" : ""
                      }`}
                    >
                      {done ? "OK" : "Brouillon"}
                    </span>
                    <span className="count-history__when">
                      {inv.countedAt.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="count-history__count">
                      {inv.lines.length} prod.
                    </span>
                    <span className="count-history__go" aria-hidden>
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </BrandPage>
  );
}
