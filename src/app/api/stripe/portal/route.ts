import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe indisponible" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.restaurantId) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    restaurantId?: string;
  };

  const isAdmin = isAdminEmail(session.user.email);
  const restaurantId =
    isAdmin && body.restaurantId
      ? body.restaurantId
      : session.user.restaurantId;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant?.stripeCustomerId) {
    return NextResponse.json(
      { error: "Aucun abonnement Stripe lié" },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const returnUrl = isAdmin && body.restaurantId
    ? `${origin}/admin/stores/${restaurantId}`
    : `${origin}/settings`;

  const portal = await stripe.billingPortal.sessions.create({
    customer: restaurant.stripeCustomerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: portal.url });
}
