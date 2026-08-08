import Link from "next/link";
import { LAUNCH_OFFER } from "@/lib/affiliate";

/** Carte offre empilée — identité lime / ink. */
export function MobileLandingOffer() {
  return (
    <section className="mland-offer" aria-label="Offre de lancement">
      <div className="mland-offer__card">
        <p className="mland-offer__kicker">Offre de lancement</p>
        <p className="mland-offer__line">
          −{LAUNCH_OFFER.discountPercent}&nbsp;% le premier mois + WhatsApp
          configuré en {LAUNCH_OFFER.setupMinutes}&nbsp;min.
        </p>
        <Link href="/welcome/details" className="mland-link">
          Détails Commerce / Franchise
        </Link>
      </div>
    </section>
  );
}
