import Link from "next/link";
import { MarginLogo } from "@/components/brand/MarginLogo";
import { LAUNCH_OFFER } from "@/lib/affiliate";

/** Viewport 1 — promesse + CTA offre (pas de copilote en entrée). */
export function MobileLandingHero() {
  return (
    <header className="mland-hero">
      <div className="mland-hero__logo">
        <MarginLogo tone="light" href="/welcome" />
      </div>
      <h1 className="mland-hero__title">
        Votre stock se met à jour à chaque vente.
      </h1>
      <p className="mland-hero__lead">
        Relié à votre caisse. Zéro ressaisie.
      </p>
      <Link href="/signup" className="mland-btn mland-btn--primary">
        Profiter de l&apos;offre
        <span aria-hidden>→</span>
      </Link>
      <p className="mland-hero__trust">
        −{LAUNCH_OFFER.discountPercent}&nbsp;% le 1<sup>er</sup> mois · WhatsApp
        en {LAUNCH_OFFER.setupMinutes}&nbsp;min
      </p>
    </header>
  );
}
