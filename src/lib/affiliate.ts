/**
 * Programme d’affiliation Margin — règles produit (V1).
 * Parrain = magasin actif ; filleul = nouveau signup via ?ref=CODE.
 */

export const AFFILIATE = {
  /** Mois de Commerce offerts au parrain par filleul payant */
  rewardMonthsReferrer: 1,
  /** Remise % sur le 1er mois du filleul (affichée marketing) */
  discountPercentReferee: 20,
  /** Commission % sur les 12 premiers mois d’abo du filleul (alternative cash — affichée) */
  commissionPercentYear1: 20,
  /** Mode de récompense actif V1 */
  mode: "credit_month" as "credit_month" | "commission",
};

/** Accroche V1 — landing, téléphone, affiliation */
export const LAUNCH_OFFER = {
  discountPercent: AFFILIATE.discountPercentReferee,
  setupMinutes: 30,
  /** Phrase courte à dire au téléphone / hero */
  hook: `−${AFFILIATE.discountPercentReferee} % le 1er mois + on configure WhatsApp avec vous en 30 min`,
  short: `−${AFFILIATE.discountPercentReferee} % le 1er mois · WhatsApp configuré en 30 min`,
};

export function referralSignupPath(code: string): string {
  return `/signup?ref=${encodeURIComponent(code)}`;
}

export function absoluteReferralUrl(code: string, baseUrl?: string): string {
  const base =
    (baseUrl || process.env.NEXTAUTH_URL || "http://localhost:3020").replace(
      /\/$/,
      ""
    );
  return `${base}${referralSignupPath(code)}`;
}

/** Code court stable à partir de l’id restaurant (lisible à l’oral). */
export function codeFromRestaurantId(restaurantId: string): string {
  const raw = restaurantId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const slice = (raw.slice(-8) || "MARGIN01").padStart(6, "0");
  return `MS-${slice}`;
}

/** Normalise un code saisi / URL (?ref=). */
export function normalizeReferralCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}
