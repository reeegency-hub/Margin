import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { ingestStripeWebhookEvent } from "@/lib/stripe/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Stripe — signature HMAC + journal idempotent (event.id).
 * Events : checkout, subscription.*, invoice.payment_failed/succeeded.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  const raw = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  try {
    const result = await ingestStripeWebhookEvent(event, raw);
    return NextResponse.json({
      received: true,
      duplicate: Boolean(result.duplicate),
      status: result.status,
      eventId: result.eventId,
    });
  } catch (err) {
    console.error("[stripe webhook handler]", err);
    // 500 → Stripe retentera (Smart Retries côté delivery)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
