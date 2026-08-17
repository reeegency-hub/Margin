/**
 * Ingest webhooks Stripe — idempotent via StripeWebhookEvent.stripeEventId.
 */
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import {
  applySubscriptionState,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  markSubscriptionDeleted,
  resolveRestaurantIdFromStripe,
} from "@/lib/stripe/apply";
import { notifyPosOpsAlert } from "@/lib/pos/ops-alert";

const STRIPE_RETRY_MAX = 8;

function nextRetryAt(attempts: number): Date {
  const seconds = Math.min(3600, 30 * Math.pow(2, Math.max(0, attempts)));
  return new Date(Date.now() + seconds * 1000);
}

function hashPayload(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function customerIdFrom(
  obj: { customer?: string | { id: string } | null }
): string | null {
  if (!obj.customer) return null;
  return typeof obj.customer === "string" ? obj.customer : obj.customer.id;
}

/** Compat API Stripe (subscription sur Invoice ou parent). */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const anyInv = invoice as Stripe.Invoice & {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string } };
  };
  const sub = anyInv.subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object" && "id" in sub) return sub.id;
  const nested = anyInv.parent?.subscription_details?.subscription;
  return nested || null;
}

export async function processStripeEvent(
  event: Stripe.Event
): Promise<{ status: string; restaurantId?: string | null }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe non configuré");

  let restaurantId: string | null = null;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    restaurantId = await resolveRestaurantIdFromStripe({
      restaurantId: session.metadata?.restaurantId,
      customerId: customerIdFrom(session),
    });
    if (restaurantId && session.subscription) {
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      const subscription = await stripe.subscriptions.retrieve(subId);
      await applySubscriptionState(
        restaurantId,
        subscription,
        session.metadata?.plan,
        session.metadata?.billingPeriod
      );
    }
    return { status: "APPLIED", restaurantId };
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    restaurantId = await resolveRestaurantIdFromStripe({
      restaurantId: subscription.metadata?.restaurantId,
      customerId: customerIdFrom(subscription),
      subscriptionId: subscription.id,
    });
    if (restaurantId) {
      await applySubscriptionState(
        restaurantId,
        subscription,
        subscription.metadata?.plan,
        subscription.metadata?.billingPeriod
      );
    }
    return { status: restaurantId ? "APPLIED" : "IGNORED_DUP", restaurantId };
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    restaurantId = await resolveRestaurantIdFromStripe({
      restaurantId: subscription.metadata?.restaurantId,
      customerId: customerIdFrom(subscription),
      subscriptionId: subscription.id,
    });
    if (restaurantId) {
      const reason = subscription.cancellation_details?.reason;
      const voluntary =
        reason === "payment_failed"
          ? false
          : Boolean(subscription.cancel_at_period_end) ||
            reason === "cancellation_requested";
      await markSubscriptionDeleted(restaurantId, { voluntary });
    }
    return { status: restaurantId ? "APPLIED" : "IGNORED_DUP", restaurantId };
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId = invoiceSubscriptionId(invoice);
    restaurantId = await resolveRestaurantIdFromStripe({
      customerId: customerIdFrom(invoice),
      subscriptionId: subId,
    });
    if (restaurantId) {
      await handleInvoicePaymentFailed(restaurantId, invoice);
    }
    return { status: restaurantId ? "APPLIED" : "IGNORED_DUP", restaurantId };
  }

  if (
    event.type === "invoice.payment_succeeded" ||
    event.type === "invoice.paid"
  ) {
    const invoice = event.data.object as Stripe.Invoice;
    const subId = invoiceSubscriptionId(invoice);
    restaurantId = await resolveRestaurantIdFromStripe({
      customerId: customerIdFrom(invoice),
      subscriptionId: subId,
    });
    if (restaurantId) {
      await handleInvoicePaymentSucceeded(restaurantId, {
        billingReason: invoice.billing_reason,
        amountPaidCents: invoice.amount_paid ?? null,
      });
      if (subId) {
        const subscription = await stripe.subscriptions.retrieve(subId);
        await applySubscriptionState(restaurantId, subscription);
      }
    }
    return { status: restaurantId ? "APPLIED" : "IGNORED_DUP", restaurantId };
  }

  // Autres events : ACK sans effet
  return { status: "APPLIED", restaurantId: null };
}

export async function ingestStripeWebhookEvent(
  event: Stripe.Event,
  rawBody: string
): Promise<{ duplicate?: boolean; status: string; eventId: string }> {
  const payloadHash = hashPayload(rawBody);
  const rawPayload = rawBody.slice(0, 12000);

  try {
    const created = await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        payloadHash,
        status: "RECEIVED",
        rawPayload,
      },
      select: { id: true },
    });

    return applyStoredStripeEvent(created.id, event);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/unique|Unique|constraint/i.test(msg)) throw err;

    const existing = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });
    if (!existing) throw err;

    if (existing.status === "APPLIED" || existing.status === "IGNORED_DUP") {
      return {
        duplicate: true,
        status: existing.status,
        eventId: existing.id,
      };
    }

    if (
      existing.status === "FAILED" ||
      existing.status === "RECEIVED" ||
      existing.status === "DEAD" ||
      existing.status === "PROCESSING"
    ) {
      return applyStoredStripeEvent(existing.id, event);
    }

    return {
      duplicate: true,
      status: existing.status,
      eventId: existing.id,
    };
  }
}

async function applyStoredStripeEvent(
  rowId: string,
  event: Stripe.Event
): Promise<{ status: string; eventId: string; duplicate?: boolean }> {
  await prisma.stripeWebhookEvent.update({
    where: { id: rowId },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });

  try {
    const result = await processStripeEvent(event);
    await prisma.stripeWebhookEvent.update({
      where: { id: rowId },
      data: {
        status: result.status === "IGNORED_DUP" ? "IGNORED_DUP" : "APPLIED",
        appliedAt: new Date(),
        restaurantId: result.restaurantId || null,
        lastError: null,
        nextRetryAt: null,
      },
    });
    return { status: result.status, eventId: rowId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const row = await prisma.stripeWebhookEvent.findUnique({
      where: { id: rowId },
      select: { attempts: true },
    });
    const attempts = row?.attempts ?? 1;
    const dead = attempts >= STRIPE_RETRY_MAX;
    await prisma.stripeWebhookEvent.update({
      where: { id: rowId },
      data: {
        status: dead ? "DEAD" : "FAILED",
        lastError: msg.slice(0, 500),
        nextRetryAt: dead ? null : nextRetryAt(attempts),
      },
    });
    if (dead) {
      await notifyPosOpsAlert({
        level: "dead",
        restaurantId: "*",
        connectionId: "",
        message: `Stripe event DEAD ${event.type}: ${msg}`.slice(0, 200),
        eventId: rowId,
      });
    }
    throw err;
  }
}

/** Cron : retraiter FAILED Stripe. */
export async function processPendingStripeWebhookEvents(limit = 30): Promise<{
  processed: number;
  applied: number;
  failed: number;
}> {
  const stripe = getStripe();
  if (!stripe) return { processed: 0, applied: 0, failed: 0 };

  const now = new Date();
  const due = await prisma.stripeWebhookEvent.findMany({
    where: {
      status: { in: ["FAILED", "RECEIVED"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      attempts: { lt: STRIPE_RETRY_MAX },
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });

  let applied = 0;
  let failed = 0;

  for (const row of due) {
    if (!row.rawPayload) {
      failed += 1;
      continue;
    }
    try {
      const parsed = JSON.parse(row.rawPayload) as Stripe.Event;
      // Prefer retrieve for freshness
      let event: Stripe.Event = parsed;
      try {
        event = await stripe.events.retrieve(row.stripeEventId);
      } catch {
        event = parsed;
      }
      const result = await applyStoredStripeEvent(row.id, event);
      if (result.status === "APPLIED" || result.status === "IGNORED_DUP") {
        applied += 1;
      } else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed: due.length, applied, failed };
}
