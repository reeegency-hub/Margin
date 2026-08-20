/**
 * Tarification apporteurs / administrateurs partenaires.
 *
 * Farel (pilote) — clients amenés via ?amb=AMB-FAREL :
 *   - 80 % de l’abo client, à vie
 *   - 250 € par onboarding (à la 1ʳᵉ facture payée)
 *
 * Prochains administrateurs :
 *   - 80 % de l’abo les 2 premiers mois
 *   - 20 % ensuite
 *
 * Attribution : signup via lien / code → Referral auto → RewardEvent à chaque facture.
 */

export const FAREL_REFERRAL_CODES = ["AMB-FAREL"] as const;

export const AMBASSADOR_PRICING = {
  farel: {
    /** % abo sur chaque facture, sans limite de durée */
    subscriptionPercentLifetime: 80,
    /** Bonus unique à la 1ʳᵉ facture payée (€) */
    onboardingBonusEur: 250,
  },
  standard: {
    /** % abo factures 1 et 2 (≈ 2 premiers mois) */
    subscriptionPercentMonths1to2: 80,
    /** % abo à partir de la 3ᵉ facture */
    subscriptionPercentAfter: 20,
    onboardingBonusEur: 0,
  },
} as const;

/** Plan de référence pour les prévisions commerciales (Commerce mensuel). */
export const FORECAST_PLAN_MONTHLY_EUR = 89;

export function isFarelAmbassadorCode(code: string | null | undefined): boolean {
  const n = String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return (FAREL_REFERRAL_CODES as readonly string[]).includes(n);
}

export function isFarelAmbassador(ambassador: {
  referralCode?: string | null;
  name?: string | null;
}): boolean {
  if (isFarelAmbassadorCode(ambassador.referralCode)) return true;
  const name = String(ambassador.name || "")
    .trim()
    .toLowerCase();
  return name === "farel" || name.startsWith("farel ");
}

/** % stocké sur Referral à la création (affichage / fallback). */
export function initialCommissionPercent(ambassador: {
  referralCode?: string | null;
  name?: string | null;
}): number {
  if (isFarelAmbassador(ambassador)) {
    return AMBASSADOR_PRICING.farel.subscriptionPercentLifetime;
  }
  return AMBASSADOR_PRICING.standard.subscriptionPercentMonths1to2;
}

/**
 * % à appliquer sur une facture donnée.
 * @param paidInvoiceIndex0 0 = 1ʳᵉ facture payée du filleul, 1 = 2ᵉ, etc.
 */
export function commissionPercentForInvoice(
  ambassador: { referralCode?: string | null; name?: string | null },
  paidInvoiceIndex0: number
): number {
  if (isFarelAmbassador(ambassador)) {
    return AMBASSADOR_PRICING.farel.subscriptionPercentLifetime;
  }
  return paidInvoiceIndex0 < 2
    ? AMBASSADOR_PRICING.standard.subscriptionPercentMonths1to2
    : AMBASSADOR_PRICING.standard.subscriptionPercentAfter;
}

export function onboardingBonusEur(ambassador: {
  referralCode?: string | null;
  name?: string | null;
}): number {
  if (isFarelAmbassador(ambassador)) {
    return AMBASSADOR_PRICING.farel.onboardingBonusEur;
  }
  return AMBASSADOR_PRICING.standard.onboardingBonusEur;
}

export function pricingSummaryForAmbassador(ambassador: {
  referralCode?: string | null;
  name?: string | null;
}): string {
  if (isFarelAmbassador(ambassador)) {
    return `80 % de l’abonnement de vos clients à vie + ${AMBASSADOR_PRICING.farel.onboardingBonusEur} € par onboarding.`;
  }
  return `80 % de l’abonnement les 2 premiers mois, puis 20 %.`;
}
