import { LAUNCH_OFFER } from "@/lib/affiliate";
import { SETUP_FEE_EUR } from "@/lib/plans";
import { supportMailto } from "@/lib/support";

const GAINS = [
  {
    id: "wa",
    kind: "wa",
    title: "Config WhatsApp",
    value: "Offerte",
    hint: `${LAUNCH_OFFER.setupMinutes} min · en live`,
  },
  {
    id: "cash",
    kind: "cash",
    title: "1er mois",
    value: `−${LAUNCH_OFFER.discountPercent} %`,
    hint: "Sur Commerce ou Franchise",
  },
  {
    id: "setup",
    kind: "setup",
    title: "Setup caisse",
    value: `~${SETUP_FEE_EUR} €`,
    hint: "Économisés en Franchise",
  },
] as const;

/** Offre visuelle — gains concrets (Calendly réservé au desktop). */
export function MobileLandingOffer() {
  const commerceAfter = Math.round(89 * (1 - LAUNCH_OFFER.discountPercent / 100));

  return (
    <section className="mland-offer" id="offre" aria-label="Programme pilote">
      <div className="mland-offer__card">
        <p className="mland-offer__kicker">Programme pilote · 5 commerces</p>
        <h2 className="mland-offer__title">Ce que vous gagnez</h2>
        <p className="mland-offer__line">
          Places limitées — config WhatsApp offerte, et jusqu’à ~
          {SETUP_FEE_EUR}&nbsp;€ de setup économisés en Franchise.
        </p>

        <div className="mland-offer__visual" aria-hidden>
          <div className="mland-offer__badge">
            <strong>−{LAUNCH_OFFER.discountPercent}%</strong>
            <span>
              1<sup>er</sup> mois
            </span>
          </div>

          <div className="mland-offer__price">
            <div className="mland-offer__price-row">
              <span className="mland-offer__price-was">89 €</span>
              <span className="mland-offer__price-arrow" />
              <span className="mland-offer__price-now">
                {commerceAfter}&nbsp;€
              </span>
            </div>
            <small>
              Commerce · HT le 1<sup>er</sup> mois
            </small>
          </div>
        </div>

        <ul className="mland-offer__gains">
          {GAINS.map((g) => (
            <li key={g.id} className={`mland-offer__gain is-${g.kind}`}>
              <span className="mland-offer__gain-icon" />
              <div className="mland-offer__gain-txt">
                <span className="mland-offer__gain-label">{g.title}</span>
                <strong>{g.value}</strong>
                <small>{g.hint}</small>
              </div>
            </li>
          ))}
        </ul>

        <div className="mland-offer__book">
          <p className="mland-offer__book-label">Config WhatsApp offerte</p>
          <div className="mland-offer__fallback">
            <div className="mland-offer__wa-preview" aria-hidden>
              <span className="mland-offer__wa-dot" />
              <div className="mland-offer__wa-copy">
                <strong>Config WhatsApp offerte</strong>
                <small>
                  Avec vous en direct · {LAUNCH_OFFER.setupMinutes} min
                </small>
              </div>
              <span className="mland-offer__save">
                −{SETUP_FEE_EUR}&nbsp;€
                <em>setup</em>
              </span>
            </div>
            <p>
              On branche votre alerte rupture ensemble. En Franchise, le setup
              caisse (~{SETUP_FEE_EUR}&nbsp;€) est inclus. Pour réserver un
              créneau, ouvrez Margin sur ordinateur.
            </p>
            <a
              href={supportMailto("Config WhatsApp offerte Margin")}
              className="mland-btn mland-btn--primary"
            >
              Nous écrire
            </a>
          </div>
        </div>

        <a
          href="/signup"
          className="mland-btn mland-btn--ghost mland-offer__signup"
        >
          Créer un compte
        </a>
      </div>
    </section>
  );
}
