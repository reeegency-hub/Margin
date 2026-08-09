import { PLANS, planPeriodSuffix } from "@/lib/plans";
import { LAUNCH_OFFER } from "@/lib/affiliate";
import { supportMailto } from "@/lib/support";

/** Tarifs Commerce / Franchise — affichés directement. */
export function MobileLandingPricing() {
  return (
    <section className="mland-pricing" id="tarifs" aria-label="Tarifs">
      <div className="mland-pricing__wrap">
        <p className="mland-pricing__eyebrow">Tarifs</p>
        <h2 className="mland-section-title">Commerce ou Franchise</h2>
        <p className="mland-pricing__lead">
          Programme pilote · −{LAUNCH_OFFER.discountPercent}&nbsp;% le 1
          <sup>er</sup> mois · HT
        </p>

        <div className="mland-pricing__grid">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`mland-plan${plan.featured ? " is-featured" : ""}`}
            >
              <header className="mland-plan__head">
                <h3>{plan.name}</h3>
                <p className="mland-plan__best">{plan.bestFor}</p>
              </header>
              <p className="mland-plan__price">
                <strong>{plan.priceMonthly}</strong>
                <span>€{planPeriodSuffix("monthly")}</span>
              </p>
              <ul className="mland-plan__feats">
                {plan.features
                  .filter((f) => !f.struck)
                  .slice(0, 4)
                  .map((f) => (
                    <li key={f.label}>{f.label}</li>
                  ))}
              </ul>
              <a
                href={supportMailto(`Place pilote — plan ${plan.name}`)}
                className={`mland-btn ${
                  plan.featured ? "mland-btn--primary" : "mland-btn--ghost"
                }`}
              >
                Demander une place
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
