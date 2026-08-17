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
    prisma.stockUnit.findMany({
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

  const inkTitle = draft
    ? "Vérification en cours"
    : critical.length > 0
      ? `${critical.length} à compter d’abord`
      : ingredients.length === 0
        ? "Pas encore de stock"
        : "Compter le rayon";

  const inkDetail = draft
    ? `${draft.lines.length} produit${
        draft.lines.length > 1 ? "s" : ""
      } — reprenez pour corriger le stock.`
    : critical.length > 0
      ? "Priorité aux références sous seuil, puis validez."
      : ingredients.length === 0
        ? "Ajoutez des produits ou branchez la caisse avant de compter."
        : "Indiquez ce qu’il y a vraiment. Valider corrige le stock.";

  return (
    <BrandPage question="Vérification" guide="Vérifiez le rayon, puis validez.">
      {params.validated ? <p className="flash">Stock corrigé.</p> : null}

      <div className="dash-card dash-card--dark hub-now">
        <p className="hub-now__eyebrow">À faire maintenant</p>
        <p className="hub-now__title">{inkTitle}</p>
        <p className="hub-now__detail">{inkDetail}</p>
        <div className="hub-now__actions">
          {ingredients.length === 0 ? (
            <Link href="/ingredients" className="btn-lime">
              Ouvrir le stock
            </Link>
          ) : draft ? (
            <Link href={`/inventory/${draft.id}`} className="btn-lime">
              Continuer
            </Link>
          ) : (
            <form action={startInventory}>
              <button type="submit" className="btn-lime">
                Commencer
              </button>
            </form>
          )}
          {critical.length > 0 ? (
            <Link href="/orders" className="btn-ghost">
              Courses
            </Link>
          ) : (
            <Link href="/ingredients" className="btn-ghost">
              Voir le stock
            </Link>
          )}
        </div>
      </div>

      {critical.length > 0 ? (
        <div className="dash-card dash-card--light verify-first">
          <p className="hub-section-title">À vérifier d’abord</p>
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
        </div>
      ) : null}

      <p className="hub-secondary-link">
        <Link href="/ingredients">Stock →</Link>
        {" · "}
        <Link href="/orders">Courses →</Link>
      </p>

      {history.length > 0 ? (
        <section
          className="dash-card dash-card--light count-history"
          aria-label="Historique"
        >
          <p className="count-history__label">Dernières vérifications</p>
          <ul className="count-history__list">
            {history.map((inv) => {
              const done = inv.status === "VALIDATED";
              return (
                <li key={inv.id}>
                  <Link
                    href={`/inventory/${inv.id}`}
                    className="count-history__row"
                  >
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
