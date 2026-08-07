/**
 * Accès app selon abonnement Stripe + délai de grâce.
 * Règle : `active` seul ne suffit plus — un statut Stripe bloquant coupe l’accès.
 */
const _graceRaw = Number(process.env.STRIPE_GRACE_DAYS || 7);
export const STRIPE_GRACE_DAYS = Math.min(
  14,
  Math.max(1, Number.isFinite(_graceRaw) ? _graceRaw : 7)
);

export type AccessRestaurant = {
  active: boolean;
  stripeStatus: string | null;
  accessGraceUntil: Date | null;
};

const BLOCKED = new Set([
  "incomplete",
  "incomplete_expired",
  "canceled",
  "cancelled",
  "unpaid",
  "past_due",
]);

export function isPaidAccessStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "active" || s === "trialing";
}

/**
 * Accès produit :
 * - paid/trialing → OK
 * - past_due/unpaid dans la fenêtre de grâce → OK
 * - incomplete/canceled/… → refusé (même si active=true)
 * - seed / ops sans Stripe (active + statut vide/none) → OK
 */
export function hasAppAccess(r: AccessRestaurant): boolean {
  const status = (r.stripeStatus || "").toLowerCase().trim();

  if (isPaidAccessStatus(status)) return true;

  if (status === "past_due" || status === "unpaid") {
    return Boolean(
      r.accessGraceUntil && r.accessGraceUntil.getTime() > Date.now()
    );
  }

  if (BLOCKED.has(status)) return false;

  // Pilote / seed : active sans statut Stripe (ou "none")
  if (r.active && (!status || status === "none")) return true;

  return false;
}

export function computeGraceUntil(from = new Date()): Date {
  return new Date(from.getTime() + STRIPE_GRACE_DAYS * 24 * 60 * 60 * 1000);
}
