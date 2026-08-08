/**
 * Plans Margin — 2 formules (paliers métier), caisse branchée.
 * Commerce : 1 boutique, catalogue plafonné — mise en place caisse NON prise en charge.
 * Franchise : multi-boutiques, catalogue illimité — mise en place technique Margin.
 */
export type PlanId = "boutique" | "commerce" | "reseau";
export type BillingPeriod = "monthly" | "yearly";

export type PlanFeature = {
  label: string;
  /** Barré en rouge — non inclus / non pris en charge */
  struck?: boolean;
  /** Mis en avant (bénéfice) */
  highlight?: boolean;
};

export type PlanDef = {
  id: PlanId;
  name: string;
  bestFor: string;
  description: string;
  priceMonthly: number;
  /** Fourchette indicative affichée — optionnel */
  priceRangeHint?: string;
  /** Limites métier du palier */
  maxStores: number;
  /** null = illimité */
  maxProducts: number | null;
  featured?: boolean;
  features: PlanFeature[];
  cta: string;
};

export const SETUP_FEE_EUR = 400;
export const YEARLY_DISCOUNT = 0.2;

export const PLANS: PlanDef[] = [
  {
    id: "commerce",
    name: "Commerce",
    bestFor: "1 boutique · jusqu’à 200 produits",
    description:
      "Palier Starter : un commerce, catalogue jusqu’à 200 produits. Votre caisse alimente le stock, les alertes WhatsApp et la vérification. La mise en place technique sur la caisse n’est pas prise en charge par Margin : vous (ou votre prestataire) branchez le lien.",
    priceMonthly: 89,
    maxStores: 1,
    maxProducts: 200,
    featured: true,
    features: [
      { label: "Stock relié à votre caisse", highlight: true },
      { label: "Alertes WhatsApp avant rupture" },
      { label: "Vérification rayon" },
      { label: "Liste de courses automatique" },
      {
        label: `Setup caisse non inclus — vous (ou votre prestataire) branchez le lien, ~${SETUP_FEE_EUR} € si accompagnement`,
        struck: true,
      },
    ],
    cta: "Démarrer Commerce",
  },
  {
    id: "reseau",
    name: "Franchise",
    bestFor: "1 à 3 boutiques · produits illimités",
    description:
      "Palier Pro : jusqu’à 3 commerces, catalogue illimité. Tout Commerce, plus la vue réseau. Margin réalise la mise en place technique sur chaque caisse — un coût énorme économisé à chaque ouverture.",
    priceMonthly: 249,
    maxStores: 3,
    maxProducts: null,
    features: [
      { label: "Tout Commerce", highlight: true },
      {
        label: `Setup caisse inclus — jusqu’à ${SETUP_FEE_EUR} € économisés par boutique`,
        highlight: true,
      },
      { label: "Équipe : planning et pointage" },
      { label: "Accompagnement prioritaire" },
    ],
    cta: "Démarrer Franchise",
  },
];

export function planPrice(plan: PlanDef, period: BillingPeriod): number {
  if (period === "yearly") {
    return Math.round(plan.priceMonthly * 12 * (1 - YEARLY_DISCOUNT));
  }
  return plan.priceMonthly;
}

export function planPriceLabel(plan: PlanDef, period: BillingPeriod): string {
  return `${planPrice(plan, period)} €`;
}

export function planPeriodSuffix(period: BillingPeriod): string {
  return period === "yearly" ? "/an" : "/mois";
}

export function planLimitsLabel(plan: PlanDef): string {
  const stores =
    plan.maxStores === 1
      ? "1 boutique"
      : `Jusqu’à ${plan.maxStores} boutiques`;
  const products =
    plan.maxProducts == null
      ? "produits illimités"
      : `jusqu’à ${plan.maxProducts} produits`;
  return `${stores} · ${products}`;
}

/** Tag logo topbar : commerce (Starter) ↔ franchise (réseau). */
export function planLogoTag(
  plan: string | null | undefined
): "commerce" | "franchise" {
  return plan === "reseau" ? "franchise" : "commerce";
}
