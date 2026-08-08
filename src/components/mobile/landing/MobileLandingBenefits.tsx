const BENEFITS = [
  {
    step: "01",
    title: "Ticket caisse",
    result: "Stock à jour",
    hint: "Chaque vente met le rayon à jour — zéro ressaisie.",
    icon: "ticket",
  },
  {
    step: "02",
    title: "Alerte WhatsApp",
    result: "Avant rupture",
    hint: "Une décision, deux clics — même en plein rush.",
    icon: "wa",
  },
  {
    step: "03",
    title: "Vérif rayon",
    result: "10 minutes",
    hint: "Corrigez l’écart, repartez serein.",
    icon: "check",
  },
] as const;

/** Bénéfices — scènes visuelles en 3 temps. */
export function MobileLandingBenefits() {
  return (
    <section className="mland-benefits" aria-label="Bénéfices">
      <div className="mland-benefits__wrap">
        <p className="mland-benefits__eyebrow">En boutique</p>
        <h2 className="mland-section-title">Ce que ça change</h2>
        <p className="mland-benefits__lead">
          Trois gestes. Le stock suit la caisse — pas l’inverse.
        </p>

        <ol className="mland-benefits__flow">
          {BENEFITS.map((b, i) => (
            <li key={b.step} className={`mland-benefits__card is-${b.icon}`}>
              <div className="mland-benefits__card-top">
                <span className="mland-benefits__step">{b.step}</span>
                <span className="mland-benefits__icon" aria-hidden />
              </div>
              <div className="mland-benefits__card-body">
                <strong>{b.title}</strong>
                <span className="mland-benefits__result">{b.result}</span>
                <small>{b.hint}</small>
              </div>
              {i < BENEFITS.length - 1 ? (
                <span className="mland-benefits__connector" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
