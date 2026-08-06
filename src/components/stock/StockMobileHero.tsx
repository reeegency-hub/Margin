import Link from "next/link";
import { formatKitchenQty } from "@/lib/units";

type CriticalProduct = {
  name: string;
  unit: string;
  stockTheoretical: number;
  criticalThreshold: number;
};

/**
 * Hero Stock téléphone — un signal clair : quoi racheter en premier.
 * (Desktop garde les TrendCard / StatCard.)
 */
export function StockMobileHero({
  critical,
  productCount,
}: {
  critical: CriticalProduct[];
  productCount: number;
}) {
  const worst = critical[0];
  const others = Math.max(0, critical.length - 1);
  const hot = critical.length > 0;

  return (
    <section
      className={`stock-mobile-hero ${
        hot ? "stock-mobile-hero--hot" : "stock-mobile-hero--calm"
      }`}
      aria-label="État du stock"
    >
      {hot && worst ? (
        <>
          <p className="stock-mobile-hero__eyebrow">Priorité du jour</p>
          <p className="stock-mobile-hero__count">
            <span className="tabular-nums">{critical.length}</span>
            {" "}
            à racheter
          </p>
          <div className="stock-mobile-hero__focus">
            <p className="stock-mobile-hero__name">{worst.name}</p>
            <p className="stock-mobile-hero__meta">
              Reste{" "}
              <strong>
                {formatKitchenQty(
                  worst.stockTheoretical,
                  worst.unit,
                  worst.name
                )}
              </strong>
              {worst.criticalThreshold > 0 ? (
                <>
                  {" "}
                  · seuil{" "}
                  {formatKitchenQty(
                    worst.criticalThreshold,
                    worst.unit,
                    worst.name
                  )}
                </>
              ) : null}
            </p>
            {others > 0 ? (
              <p className="stock-mobile-hero__more">
                + {others} autre{others > 1 ? "s" : ""} sous le seuil
              </p>
            ) : null}
          </div>
          <div className="stock-mobile-hero__actions">
            <Link
              href="/orders"
              className="stock-mobile-hero__btn stock-mobile-hero__btn--primary"
            >
              Préparer la liste
            </Link>
            <Link href="/inventory" className="stock-mobile-hero__btn">
              Vérification
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="stock-mobile-hero__eyebrow">Stock</p>
          <p className="stock-mobile-hero__count stock-mobile-hero__count--ok">
            Tout est OK
          </p>
          <p className="stock-mobile-hero__meta">
            {productCount} produit{productCount > 1 ? "s" : ""} suivi
            {productCount > 1 ? "s" : ""} — aucun sous le seuil.
          </p>
          <div className="stock-mobile-hero__actions">
            <Link
              href="/inventory"
              className="stock-mobile-hero__btn stock-mobile-hero__btn--primary"
            >
              Vérification
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
