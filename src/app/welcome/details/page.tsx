import Link from "next/link";
import type { Metadata } from "next";
import { PLANS, SETUP_FEE_EUR, planPeriodSuffix } from "@/lib/plans";
import { LAUNCH_OFFER } from "@/lib/affiliate";
import { MarginLogo } from "@/components/brand/MarginLogo";
import { supportMailto } from "@/lib/support";
import "@/components/mobile/landing/mobile-landing.css";

export const metadata: Metadata = {
  title: "Tarifs Margin — Commerce & Franchise",
  description: "Détails des formules Commerce et Franchise.",
  robots: { index: false },
};

/** Page détails plans — accessible depuis la landing mobile (pas dans le scroll). */
export default function WelcomeDetailsPage() {
  return (
    <div className="mland" style={{ minHeight: "100dvh" }}>
      <div
        className="mland-main"
        style={{
          margin: 0,
          borderRadius: 0,
          minHeight: "100dvh",
          paddingTop: 24,
        }}
      >
        <Link href="/welcome" className="mland-link" style={{ fontSize: "0.85rem" }}>
          ← Retour
        </Link>
        <div style={{ margin: "16px 0 8px" }}>
          <MarginLogo />
        </div>
        <h1 className="mland-section-title" style={{ fontSize: "1.45rem" }}>
          Commerce & Franchise
        </h1>
        <p className="mland-offer__line" style={{ textAlign: "left" }}>
          Offre de lancement : −{LAUNCH_OFFER.discountPercent}&nbsp;% le premier
          mois + WhatsApp en {LAUNCH_OFFER.setupMinutes}&nbsp;min. Inscription
          libre fermée — places pilotes sur demande.
        </p>

        <ul className="mland-benefits__list" style={{ marginTop: 20 }}>
          {PLANS.map((plan) => (
            <li key={plan.id} style={{ paddingLeft: 14, display: "block" }}>
              <strong style={{ display: "block", marginBottom: 4 }}>
                {plan.name} — {plan.priceMonthly}&nbsp;€
                {planPeriodSuffix("monthly")} HT
              </strong>
              <span
                style={{
                  fontWeight: 500,
                  color: "#4b5563",
                  fontSize: "0.88rem",
                }}
              >
                {plan.bestFor}
              </span>
              <ul
                style={{
                  margin: "10px 0 0",
                  paddingLeft: 18,
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                {plan.features.map((f) => (
                  <li key={f.label} style={{ marginBottom: 4 }}>
                    {f.struck ? `✗ ${f.label}` : f.label}
                  </li>
                ))}
              </ul>
              <a
                href={supportMailto(`Place pilote — ${plan.name}`)}
                className="mland-btn mland-btn--primary"
                style={{ marginTop: 12, maxWidth: "100%" }}
              >
                Demander une place
              </a>
            </li>
          ))}
        </ul>

        <p
          className="mland-offer__line"
          style={{ textAlign: "left", marginTop: 20 }}
        >
          Setup caisse : ~{SETUP_FEE_EUR}&nbsp;€ si accompagnement — inclus en
          Franchise.
        </p>
      </div>
    </div>
  );
}
