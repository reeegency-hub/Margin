import Link from "next/link";
import { LAUNCH_OFFER } from "@/lib/affiliate";
import { MarginLogoMark } from "@/components/brand/MarginLogo";
import { MosaicOrbit, type OrbitNode } from "./MosaicOrbit";
import { MobileLandingNav } from "./MobileLandingNav";

/** Angles fixes · rayons en fraction du mosaic. */
const ORBIT: readonly OrbitNode[] = [
  {
    id: "a",
    icon: "ticket",
    title: "Stock à jour",
    sub: "Ticket caisse",
    angle: 0,
    radius: 0.27,
    tone: "ok",
  },
  {
    id: "d",
    icon: "sales",
    title: "+4 ventes",
    sub: "WhatsApp",
    angle: 60,
    radius: 0.3,
    tone: "wa",
  },
  {
    id: "b",
    icon: "wa",
    title: "2 laits",
    sub: "WhatsApp",
    angle: 120,
    radius: 0.27,
    tone: "urgent",
  },
  {
    id: "e",
    icon: "user",
    title: "Kevin",
    sub: "8h – 21h",
    angle: 180,
    radius: 0.3,
    tone: "team",
  },
  {
    id: "c",
    icon: "check",
    title: "Rayon OK",
    sub: "10 min",
    angle: 240,
    radius: 0.27,
    tone: "ok",
  },
  {
    id: "f",
    icon: "wa",
    title: "Rupture évitée",
    sub: "Commande",
    angle: 300,
    radius: 0.3,
    tone: "wa",
  },
];

/** Viewport 1 — grille nav / orbite / copy. */
export function MobileLandingHero() {
  return (
    <header className="mland-hero">
      <div className="mland-hero__visual">
        <MobileLandingNav />

        <div className="mland-hero__stage">
          <div className="mland-mosaic" aria-hidden>
            <div className="mland-mosaic__rings" />

            <span className="mland-mosaic__dot mland-mosaic__dot--1" />
            <span className="mland-mosaic__dot mland-mosaic__dot--2" />
            <span className="mland-mosaic__dot mland-mosaic__dot--3" />
            <span className="mland-mosaic__dot mland-mosaic__dot--4" />
            <span className="mland-mosaic__dot mland-mosaic__dot--5" />
            <span className="mland-mosaic__dot mland-mosaic__dot--6" />
            <span className="mland-mosaic__dot mland-mosaic__dot--7" />
            <span className="mland-mosaic__dot mland-mosaic__dot--8" />

            <div className="mland-mosaic__core">
              <MarginLogoMark className="mland-mosaic__core-logo" />
            </div>

            <MosaicOrbit nodes={ORBIT} />
          </div>
        </div>

        <div className="mland-hero__copy">
          <div className="mland-hero__copy-panel">
            <span className="mland-hero__copy-accent" aria-hidden />
            <h1 className="mland-hero__title">
              Votre stock se met
              <br />
              à jour à chaque vente.
            </h1>
            <p className="mland-hero__lead">
              Relié à votre caisse. Zéro ressaisie.
            </p>
            <Link href="/signup" className="mland-btn mland-btn--primary">
              Profiter de l&apos;offre
            </Link>
            <p className="mland-hero__trust">
              <span>
                −{LAUNCH_OFFER.discountPercent}&nbsp;% le 1<sup>er</sup> mois
              </span>
              <span className="mland-hero__trust-dot" aria-hidden />
              <span>WhatsApp en {LAUNCH_OFFER.setupMinutes}&nbsp;min</span>
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
