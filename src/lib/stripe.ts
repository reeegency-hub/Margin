import Stripe from "stripe";
import type { BillingPeriod, PlanId } from "@/lib/plans";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_PRICE_COMMERCE_MONTHLY?.trim() &&
      process.env.STRIPE_PRICE_RESEAU_MONTHLY?.trim()
  );
}

export function stripePriceId(
  plan: PlanId,
  period: BillingPeriod
): string | null {
  const map: Record<string, string | undefined> = {
    "commerce:monthly": process.env.STRIPE_PRICE_COMMERCE_MONTHLY,
    "commerce:yearly": process.env.STRIPE_PRICE_COMMERCE_YEARLY,
    "reseau:monthly": process.env.STRIPE_PRICE_RESEAU_MONTHLY,
    "reseau:yearly": process.env.STRIPE_PRICE_RESEAU_YEARLY,
    // boutique legacy → commerce
    "boutique:monthly": process.env.STRIPE_PRICE_COMMERCE_MONTHLY,
    "boutique:yearly": process.env.STRIPE_PRICE_COMMERCE_YEARLY,
  };
  const id = map[`${plan}:${period}`]?.trim();
  return id || null;
}

export function planFromStripePrice(
  priceId: string
): { plan: PlanId; billingPeriod: BillingPeriod } | null {
  const pairs: Array<[string | undefined, PlanId, BillingPeriod]> = [
    [process.env.STRIPE_PRICE_COMMERCE_MONTHLY, "commerce", "monthly"],
    [process.env.STRIPE_PRICE_COMMERCE_YEARLY, "commerce", "yearly"],
    [process.env.STRIPE_PRICE_RESEAU_MONTHLY, "reseau", "monthly"],
    [process.env.STRIPE_PRICE_RESEAU_YEARLY, "reseau", "yearly"],
  ];
  for (const [id, plan, billingPeriod] of pairs) {
    if (id?.trim() === priceId) return { plan, billingPeriod };
  }
  return null;
}
