/**
 * Relances client — échec de paiement (dunning).
 */
import type Stripe from "stripe";
import { STRIPE_GRACE_DAYS } from "@/lib/stripe/access";
import { getStripe } from "@/lib/stripe";
import { sendWhatsAppOutbound } from "@/lib/whatsapp/outbound";

function appBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.WEBHOOK_BASE_URL ||
    "http://localhost:3020"
  ).replace(/\/$/, "");
}

export async function createBillingPortalUrl(
  customerId: string | null | undefined
): Promise<string | null> {
  if (!customerId) return `${appBaseUrl()}/settings`;
  const stripe = getStripe();
  if (!stripe) return `${appBaseUrl()}/settings`;
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appBaseUrl()}/settings`,
    });
    return portal.url;
  } catch {
    return `${appBaseUrl()}/settings`;
  }
}

export async function notifyBillingDunning(opts: {
  restaurant: {
    id: string;
    name: string;
    whatsappTo: string | null;
    dunningLastNotifiedAt: Date | null;
    stripeCustomerId: string | null;
  };
  invoice: Stripe.Invoice;
  accessGraceUntil: Date;
}): Promise<boolean> {
  if (
    opts.restaurant.dunningLastNotifiedAt &&
    Date.now() - opts.restaurant.dunningLastNotifiedAt.getTime() <
      20 * 60 * 60 * 1000
  ) {
    return false;
  }

  const portalUrl = await createBillingPortalUrl(
    opts.restaurant.stripeCustomerId
  );
  const graceLabel = opts.accessGraceUntil.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const amount =
    opts.invoice.amount_due != null
      ? `${(opts.invoice.amount_due / 100).toFixed(2)} €`
      : "votre abonnement";

  const body =
    `Margin — échec de paiement (${amount}). ` +
    `Mettez à jour votre carte avant le ${graceLabel} ` +
    `(délai de grâce ${STRIPE_GRACE_DAYS} j) pour garder l’accès : ${portalUrl}`;

  const to = opts.restaurant.whatsappTo?.trim();
  if (to) {
    try {
      const result = await sendWhatsAppOutbound({
        to,
        restaurantId: opts.restaurant.id,
        purpose: "billing_dunning",
        templateKey: "billing_dunning",
        templateVars: {
          "1": amount,
          "2": graceLabel,
          "3": portalUrl || `${appBaseUrl()}/settings`,
        },
        body,
      });
      return result.ok || Boolean(result.skipped);
    } catch (err) {
      console.error("[billing dunning] WhatsApp failed", err);
    }
  }

  console.warn("[billing dunning]", {
    restaurantId: opts.restaurant.id,
    body,
  });
  return true;
}
