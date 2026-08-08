import Link from "next/link";
import { MarginLogo } from "@/components/brand/MarginLogo";
import { LAUNCH_OFFER } from "@/lib/affiliate";

/** Viewport 1 — tout dans la zone visuelle (plus de feuille blanche). */
export function MobileLandingHero() {
  return (
    <header className="mland-hero">
      <div className="mland-hero__visual">
        <div className="mland-hero__top">
          <div className="mland-hero__logo">
            <MarginLogo tone="light" href="/welcome" />
          </div>
        </div>

        <div className="mland-mosaic" aria-hidden>
          <div className="mland-mosaic__tile mland-mosaic__tile--a">
            <span className="mland-mosaic__label">Stock</span>
            <strong>À jour</strong>
            <small>Ticket #4821</small>
          </div>
          <div className="mland-mosaic__tile mland-mosaic__tile--b">
            <span className="mland-mosaic__wa" />
            <strong>2 laits</strong>
            <small>Alerte WhatsApp</small>
          </div>
          <div className="mland-mosaic__tile mland-mosaic__tile--c">
            <span className="mland-mosaic__label">Rayon</span>
            <strong>10 min</strong>
            <small>Vérif. corrigée</small>
          </div>
        </div>

        <div className="mland-hero__copy">
          <h1 className="mland-hero__title">
            Votre stock se met à jour à chaque vente.
          </h1>
          <p className="mland-hero__lead">
            Relié à votre caisse. Zéro ressaisie.
          </p>
          <Link href="/signup" className="mland-btn mland-btn--primary">
            Profiter de l&apos;offre
          </Link>
          <p className="mland-hero__trust">
            −{LAUNCH_OFFER.discountPercent}&nbsp;% le 1<sup>er</sup> mois ·
            WhatsApp en {LAUNCH_OFFER.setupMinutes}&nbsp;min
          </p>
        </div>
      </div>
    </header>
  );
}
