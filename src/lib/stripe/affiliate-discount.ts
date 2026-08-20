/**
 * Remise filleul (−20 % 1ère facture) via coupon Stripe Checkout.
 * - Auto si parrainage (?ref=)
 * - Ou code promo saisi (promotion code Stripe ou id coupon)
 */
import type Stripe from "stripe";
import { AFFILIATE } from "@/lib/affiliate";

/** Id stable — créé une fois par compte Stripe (test / live). */
export const AFFILIATE_COUPON_ID = "margin_ref_20_once";

/** Codes promo acceptés côté UI (hors id Stripe technique). */
export const AFFILIATE_PROMO_ALIASES = [
  "MARGIN20",
  "MARGIN-20",
  "AFFILIE20",
  "PARRAIN20",
  "-20",
] as const;

export async function resolveAffiliateCouponId(
  stripe: Stripe
): Promise<string> {
  const fromEnv = process.env.STRIPE_COUPON_AFFILIATE?.trim();
  if (fromEnv) return fromEnv;

  try {
    const existing = await stripe.coupons.retrieve(AFFILIATE_COUPON_ID);
    if (existing.valid !== false) return existing.id;
  } catch {
    // crée ci-dessous
  }

  const created = await stripe.coupons.create({
    id: AFFILIATE_COUPON_ID,
    percent_off: AFFILIATE.discountPercentReferee,
    duration: "once",
    name: `Affiliation −${AFFILIATE.discountPercentReferee} % 1er mois`,
    metadata: { purpose: "affiliate_referee" },
  });
  return created.id;
}

/**
 * Résout un code tapé par le commerçant → discounts Checkout.
 * Accepte : promotion code Stripe, id coupon, alias MARGIN20 → coupon affiliation.
 */
export async function resolvePromoCheckoutDiscounts(
  stripe: Stripe,
  rawCode: string | null | undefined
): Promise<
  | { ok: true; discounts: Stripe.Checkout.SessionCreateParams.Discount[] }
  | { ok: false; error: string }
> {
  const code = String(rawCode || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!code) {
    return { ok: false, error: "Code promo vide." };
  }

  const aliasHit = (AFFILIATE_PROMO_ALIASES as readonly string[]).includes(
    code
  );
  if (aliasHit) {
    const coupon = await resolveAffiliateCouponId(stripe);
    return { ok: true, discounts: [{ coupon }] };
  }

  try {
    const promos = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
    });
    const promo = promos.data[0];
    if (promo?.id) {
      return { ok: true, discounts: [{ promotion_code: promo.id }] };
    }
  } catch {
    // continue
  }

  try {
    const coupon = await stripe.coupons.retrieve(code);
    if (coupon && coupon.valid !== false) {
      return { ok: true, discounts: [{ coupon: coupon.id }] };
    }
  } catch {
    // continue
  }

  // Dernier recours : env coupon id exact (casse libre)
  const fromEnv = process.env.STRIPE_COUPON_AFFILIATE?.trim();
  if (fromEnv && fromEnv.toUpperCase() === code) {
    return { ok: true, discounts: [{ coupon: fromEnv }] };
  }

  return {
    ok: false,
    error: `Code « ${code} » inconnu. Vérifiez-le ou laissez vide.`,
  };
}

/** Params Checkout : discounts parrainage et/ou code saisi. */
export async function affiliateCheckoutDiscounts(
  stripe: Stripe,
  hasReferrer: boolean,
  promoCode?: string | null
): Promise<
  | {
      discounts?: Stripe.Checkout.SessionCreateParams.Discount[];
      allowPromotionCodes?: boolean;
      promoError?: string;
    }
> {
  const typed = String(promoCode || "").trim();
  if (typed) {
    const resolved = await resolvePromoCheckoutDiscounts(stripe, typed);
    if (!resolved.ok) {
      return { promoError: resolved.error, allowPromotionCodes: true };
    }
    return { discounts: resolved.discounts };
  }

  if (hasReferrer) {
    const coupon = await resolveAffiliateCouponId(stripe);
    return { discounts: [{ coupon }] };
  }

  // Pas de code : Stripe Checkout laisse saisir un promo code
  return { allowPromotionCodes: true };
}
