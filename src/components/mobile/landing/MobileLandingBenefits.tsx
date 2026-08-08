const BENEFITS = [
  "Ticket caisse → stock à jour",
  "Alerte WhatsApp avant rupture",
  "Vérification rayon en 10 min",
] as const;

/** 3 puces — pas de cartes. */
export function MobileLandingBenefits() {
  return (
    <section className="mland-benefits" aria-label="Bénéfices">
      <h2 className="mland-section-title">Ce que ça change</h2>
      <ul className="mland-benefits__list">
        {BENEFITS.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </section>
  );
}
