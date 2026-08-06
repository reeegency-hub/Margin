import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
          "Paiement non configuré. Contactez Margin ou utilisez /admin pour créer le magasin.",
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
  const restaurantId = body.restaurantId || session?.user?.restaurantId;
  let customerEmail = session?.user?.email || undefined;
  let customerId: string | undefined;

  if (restaurantId) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { users: { take: 1 } },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Magasin introuvable" }, { status: 404 });
    }
    customerEmail = restaurant.users[0]?.email || customerEmail;
    customerId = restaurant.stripeCustomerId || undefined;
  }

  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/onboarding?paid=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/welcome#tarifs`;

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    customer_email: customerId ? undefined : customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      plan,
      billingPeriod,
      restaurantId: restaurantId || "",
    },
    subscription_data: {
      metadata: {
        plan,
        billingPeriod,
        restaurantId: restaurantId || "",
      },
    },
  });

  return NextResponse.json({ url: checkout.url });
}
