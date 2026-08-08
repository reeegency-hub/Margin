import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";
import {
  getStripe,
  isStripeConfigured,
  stripePriceId,
} from "@/lib/stripe";
import type { BillingPeriod, PlanId } from "@/lib/plans";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Paiement non configuré. Contactez Margin ou utilisez /admin pour créer le commerce.",
      },
      { status: 503 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe indisponible" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    plan?: string;
    billingPeriod?: string;
    restaurantId?: string;
  };

  const plan = (body.plan || "commerce") as PlanId;
  const billingPeriod = (body.billingPeriod || "monthly") as BillingPeriod;
  if (!["commerce", "reseau", "boutique"].includes(plan)) {
    return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
  }
  if (!["monthly", "yearly"].includes(billingPeriod)) {
    return NextResponse.json({ error: "Période invalide" }, { status: 400 });
  }

  const priceId = stripePriceId(plan, billingPeriod);
  if (!priceId) {
    return NextResponse.json(
      { error: "Prix Stripe manquant pour ce plan" },
      { status: 500 }
    );
  }

  const session = await getServerSession(authOptions);
  const isAdmin = isAdminEmail(session?.user?.email);
  // Tenant depuis la session uniquement — body.restaurantId réservé aux admins Ops.
  const restaurantId =
    isAdmin && body.restaurantId
      ? body.restaurantId
      : session?.user?.restaurantId || undefined;
  let customerEmail = session?.user?.email || undefined;
  let customerId: string | undefined;
  let hasReferrer = false;
  let referredByRestaurantId = "";

  if (restaurantId) {
    if (
      !isAdmin &&
      session?.user?.restaurantId &&
      restaurantId !== session.user.restaurantId
    ) {
      return NextResponse.json({ error: "Commerce introuvable" }, { status: 404 });
    }
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { users: { take: 1 } },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Commerce introuvable" }, { status: 404 });
    }
    customerEmail = restaurant.users[0]?.email || customerEmail;
    customerId = restaurant.stripeCustomerId || undefined;
    hasReferrer = Boolean(restaurant.referredByRestaurantId);
    referredByRestaurantId = restaurant.referredByRestaurantId || "";
  }

  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/onboarding?paid=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/welcome#tarifs`;

  const { affiliateCheckoutDiscounts } = await import(
    "@/lib/stripe/affiliate-discount"
  );
  const discounts = await affiliateCheckoutDiscounts(stripe, hasReferrer);

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    customer_email: customerId ? undefined : customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    ...(discounts ? { discounts } : {}),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      plan,
      billingPeriod,
      restaurantId: restaurantId || "",
      affiliateDiscount: discounts ? "1" : "0",
      referredByRestaurantId,
    },
    subscription_data: {
      metadata: {
        plan,
        billingPeriod,
        restaurantId: restaurantId || "",
        referredByRestaurantId,
      },
    },
  });

  return NextResponse.json({ url: checkout.url });
}
