/**
 * Relances client — échec de paiement (dunning).
 * Retourne true UNIQUEMENT si un canal client a bien délivré (WA ou email).
 * Sinon false → pas de tampon dunningLastNotifiedAt (réessai au prochain webhook).
 */
import type Stripe from "stripe";
import { STRIPE_GRACE_DAYS } from "@/lib/stripe/access";
import { getStripe } from "@/lib/stripe";
import { sendWhatsAppOutbound } from "@/lib/whatsapp/outbound";
import { prisma } from "@/lib/db";

function appBaseUrl(): string {
  const candidates = [
    process.env.NEXTAUTH_URL,
    process.env.WEBHOOK_BASE_URL,
    "https://margin-shop.vercel.app",
  ];
  for (const raw of candidates) {
    const v = (raw || "").trim().replace(/\/$/, "");
    if (
      v &&
      /^https?:\/\//i.test(v) &&
      !v.includes("[SENSITIVE]") &&
      !v.includes("VOTRE-DOMAINE")
    ) {
      return v;
    }
  }
  return "https://margin-shop.vercel.app";
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

async function sendDunningEmail(opts: {
  to: string;
  restaurantName: string;
  amount: string;
  graceLabel: string;
  portalUrl: string;
}): Promise<boolean> {
  const subject = `Margin — échec de paiement (${opts.amount})`;
  const text =
    `Bonjour,\n\n` +
    `Le paiement de ${opts.restaurantName} (${opts.amount}) a échoué. ` +
    `Mettez à jour votre carte avant le ${opts.graceLabel} ` +
    `(grâce ${STRIPE_GRACE_DAYS} j) : ${opts.portalUrl}\n\n` +
    `— Margin`;
  const html =
    `<p>Bonjour,</p>` +
    `<p>Le paiement de <strong>${escapeHtml(opts.restaurantName)}</strong> ` +
    `(${escapeHtml(opts.amount)}) a échoué.</p>` +
    `<p>Mettez à jour votre carte avant le <strong>${escapeHtml(opts.graceLabel)}</strong> ` +
    `(délai de grâce ${STRIPE_GRACE_DAYS} j) pour garder l’accès.</p>` +
    `<p><a href="${escapeHtml(opts.portalUrl)}">Mettre à jour la carte</a></p>` +
    `<p>— Margin</p>`;

  const { sendResendEmail } = await import("@/lib/resend-from");
  const sent = await sendResendEmail({
    to: opts.to,
    subject,
    html,
    text,
  });
  return sent.ok;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  /** Email gérant — sinon 1er user du commerce */
  email?: string | null;
}): Promise<boolean> {
  if (
    opts.restaurant.dunningLastNotifiedAt &&
    Date.now() - opts.restaurant.dunningLastNotifiedAt.getTime() <
      20 * 60 * 60 * 1000
  ) {
    return false;
  }

  const portalUrl =
    (await createBillingPortalUrl(opts.restaurant.stripeCustomerId)) ||
    `${appBaseUrl()}/settings`;
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

  let delivered = false;

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
          "3": portalUrl,
        },
        body,
      });
      if (result.ok) {
        delivered = true;
      } else {
        console.error("[billing dunning] WhatsApp not delivered", {
          restaurantId: opts.restaurant.id,
          reason: result.reason,
          skipped: result.skipped,
        });
      }
    } catch (err) {
      console.error("[billing dunning] WhatsApp failed", err);
    }
  }

  if (!delivered) {
    let email = opts.email?.trim() || null;
    if (!email) {
      const user = await prisma.user.findFirst({
        where: { restaurantId: opts.restaurant.id },
        select: { email: true },
        orderBy: { createdAt: "asc" },
      });
      email = user?.email || null;
    }
    if (email) {
      delivered = await sendDunningEmail({
        to: email,
        restaurantName: opts.restaurant.name,
        amount,
        graceLabel,
        portalUrl,
      });
    }
  }

  if (!delivered) {
    console.warn("[billing dunning] undelivered — will retry", {
      restaurantId: opts.restaurant.id,
      hasWhatsApp: Boolean(to),
      body,
    });
    return false;
  }

  return true;
}
