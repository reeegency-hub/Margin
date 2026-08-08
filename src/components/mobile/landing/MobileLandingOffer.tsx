import Link from "next/link";
import { LAUNCH_OFFER } from "@/lib/affiliate";

/** Une ligne offre + lien détails plans. */
export function MobileLandingOffer() {
  return (
    <section className="mland-offer" aria-label="Offre de lancement">
      <p className="mland-offer__line">
        −{LAUNCH_OFFER.discountPercent}&nbsp;% le premier mois + WhatsApp
        configuré en {LAUNCH_OFFER.setupMinutes}&nbsp;min.
      </p>
      <Link href="/welcome/details" className="mland-link">
        Détails Commerce / Franchise
      </Link>
    </section>
  );
}
