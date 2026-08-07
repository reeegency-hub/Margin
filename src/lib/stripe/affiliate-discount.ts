/**
 * Remise filleul (−20 % 1ère facture) via coupon Stripe Checkout.
 * Appliqué uniquement si referredByRestaurantId est posé (?ref=CODE valide).
 */
import type Stripe from "stripe";
import { AFFILIATE } from "@/lib/affiliate";

/** Id stable — créé une fois par compte Stripe (test / live). */
export const AFFILIATE_COUPON_ID = "margin_ref_20_once";

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

/** Params Checkout : discounts si parrainage, sinon undefined. */
export async function affiliateCheckoutDiscounts(
  stripe: Stripe,
  hasReferrer: boolean
): Promise<Stripe.Checkout.SessionCreateParams.Discount[] | undefined> {
  if (!hasReferrer) return undefined;
  const coupon = await resolveAffiliateCouponId(stripe);
  return [{ coupon }];
}
