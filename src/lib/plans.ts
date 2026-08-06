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
      "Palier Starter : un magasin, catalogue jusqu’à 200 produits. Votre caisse alimente le stock, les alertes WhatsApp et la vérification. La mise en place technique sur la caisse n’est pas prise en charge par Margin : vous (ou votre prestataire) branchez le lien.",
    priceMonthly: 89,
    maxStores: 1,
    maxProducts: 200,
    featured: true,
    features: [
      { label: "Stock à jour sans ressaisie le soir", highlight: true },
      { label: "1 boutique · jusqu’à 200 produits" },
      { label: "1 gérant + caissiers du magasin" },
      { label: "Lien caisse → stock (une fois branché)" },
      { label: "Alertes WhatsApp avant rupture" },
      { label: "Vérification rayon · liste de courses" },
      {
        label: "Mise en place technique Margin : non incluse",
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
      "Palier Pro : jusqu’à 3 magasins, catalogue illimité. Tout Commerce, plus la vue réseau. Margin réalise la mise en place technique sur chaque caisse — un coût énorme économisé à chaque ouverture.",
    priceMonthly: 249,
    maxStores: 3,
    maxProducts: null,
    features: [
      { label: "Tout Commerce, sur plusieurs sites", highlight: true },
      { label: "1 à 3 boutiques · produits illimités" },
      { label: "Vue d’ensemble de tous les magasins" },
      { label: "Utilisateurs multi-magasins" },
      { label: "Aide prioritaire de l’équipe Margin" },
      {
        label: `Branchements caisse inclus (~${SETUP_FEE_EUR} € économisés / magasin)`,
        highlight: true,
      },
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
