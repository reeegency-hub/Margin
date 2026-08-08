import type { Metadata } from "next";
import { getLandingDeviceType } from "@/lib/device";

export const metadata: Metadata = {
  title: "Margin — Stock commerce relié à votre caisse",
  description:
    "Le stock de votre boutique se met à jour à chaque vente. Alertes avant la rupture. Sans changer de caisse. −20 % le 1er mois.",
  keywords: [
    "logiciel stock commerce",
    "lien caisse stock",
    "alerte rupture stock",
    "stock Zelty",
    "stock Cashpad",
    "gestion stock boutique",
    "stock relié caisse",
  ],
  alternates: { canonical: "/welcome" },
};

/**
 * Switch device — un seul bundle landing chargé.
 * DesktopLanding : figée (aucune modif chantier mobile).
 * MobileLanding : expérience minimale validée brief.
 */
export default async function WelcomePage() {
  const device = await getLandingDeviceType();

  if (device === "mobile") {
    const { default: MobileLanding } = await import(
      "@/components/mobile/landing/MobileLanding"
    );
    return <MobileLanding />;
  }

  const { default: DesktopLanding } = await import(
    "@/components/desktop/landing/DesktopLanding"
  );
  return <DesktopLanding />;
}
