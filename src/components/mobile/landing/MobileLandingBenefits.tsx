const BENEFITS = [
  {
    title: "Ticket caisse → stock à jour",
    hint: "Chaque vente met le rayon à jour",
    icon: "ticket",
  },
  {
    title: "Alerte WhatsApp avant rupture",
    hint: "Une décision, deux clics",
    icon: "wa",
  },
  {
    title: "Vérification rayon en 10 min",
    hint: "Corrigez l’écart, repartez",
    icon: "check",
  },
] as const;

/** Liste type rows — pas de grille pricing. */
export function MobileLandingBenefits() {
  return (
    <section className="mland-benefits" aria-label="Bénéfices">
      <h2 className="mland-section-title">Ce que ça change</h2>
      <ul className="mland-benefits__list">
        {BENEFITS.map((b) => (
          <li key={b.title} className={`mland-benefits__row is-${b.icon}`}>
            <span className="mland-benefits__icon" aria-hidden />
            <div>
              <strong>{b.title}</strong>
              <small>{b.hint}</small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
