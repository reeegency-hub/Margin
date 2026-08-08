import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export type NewsletterSource = "signup" | "landing" | "admin" | "import";

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

export function unsubscribeUrl(token: string): string {
  return `${appBaseUrl()}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

function newUnsubscribeToken(): string {
  return createHash("sha256")
    .update(randomBytes(32))
    .digest("hex")
    .slice(0, 32);
}

export async function subscribeToNewsletter(opts: {
  email: string;
  source: NewsletterSource;
  name?: string | null;
  restaurantId?: string | null;
  sendWelcome?: boolean;
}): Promise<{ ok: true; id: string; created: boolean } | { ok: false; error: string }> {
  const email = String(opts.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Email invalide." };
  }

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email },
  });

  if (existing && !existing.unsubscribedAt) {
    // Réactive le lien restaurant si manquant
    if (opts.restaurantId && !existing.restaurantId) {
      await prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: {
          restaurantId: opts.restaurantId,
          name: opts.name || existing.name,
        },
      });
    }
    if (opts.sendWelcome && !existing.welcomeSentAt) {
      await sendWelcomeNewsletterEmail(existing.id);
    }
    return { ok: true, id: existing.id, created: false };
  }

  if (existing?.unsubscribedAt) {
    const updated = await prisma.newsletterSubscriber.update({
      where: { id: existing.id },
      data: {
        unsubscribedAt: null,
        consentedAt: new Date(),
        source: opts.source,
        name: opts.name || existing.name,
        restaurantId: opts.restaurantId ?? existing.restaurantId,
        unsubscribeToken: newUnsubscribeToken(),
      },
    });
    if (opts.sendWelcome) {
      await sendWelcomeNewsletterEmail(updated.id);
    }
    return { ok: true, id: updated.id, created: true };
  }

  const created = await prisma.newsletterSubscriber.create({
    data: {
      email,
      source: opts.source,
      name: opts.name || null,
      restaurantId: opts.restaurantId || null,
      unsubscribeToken: newUnsubscribeToken(),
    },
  });

  if (opts.sendWelcome !== false) {
    await sendWelcomeNewsletterEmail(created.id);
  }

  return { ok: true, id: created.id, created: true };
}

export async function unsubscribeByToken(
  token: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const t = String(token || "").trim();
  if (!t) return { ok: false, error: "Lien invalide." };

  const row = await prisma.newsletterSubscriber.findUnique({
    where: { unsubscribeToken: t },
  });
  if (!row) return { ok: false, error: "Lien invalide ou expiré." };

  if (!row.unsubscribedAt) {
    await prisma.newsletterSubscriber.update({
      where: { id: row.id },
      data: { unsubscribedAt: new Date() },
    });
  }
  return { ok: true, email: row.email };
}

/** Email de bienvenue newsletter (Resend si configuré, sinon log). */
export async function sendWelcomeNewsletterEmail(
  subscriberId: string
): Promise<{ sent: boolean; reason?: string }> {
  const sub = await prisma.newsletterSubscriber.findUnique({
    where: { id: subscriberId },
  });
  if (!sub || sub.unsubscribedAt) {
    return { sent: false, reason: "inactive" };
  }
  if (sub.welcomeSentAt) {
    return { sent: false, reason: "already_sent" };
  }

  const unsub = unsubscribeUrl(sub.unsubscribeToken);
  const firstName = (sub.name || "").split(/\s+/)[0] || "commerçant";
  const subject = "Bienvenue dans les conseils Margin";
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <p>Bonjour ${escapeHtml(firstName)},</p>
      <p>Merci de rejoindre Margin. Vous recevrez de temps en temps des conseils concrets pour tenir le stock sans tableur — alertes, pointages, livraisons.</p>
      <p><a href="${appBaseUrl()}/login" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:8px">Ouvrir mon commerce</a></p>
      <p style="font-size:13px;color:#666">Vous pouvez vous désinscrire à tout moment : <a href="${unsub}">lien de désinscription</a>.</p>
    </div>
  `;
  const text = `Bonjour ${firstName},\n\nMerci de rejoindre Margin. Conseils stock à venir.\n\nOuvrir : ${appBaseUrl()}/login\nDésinscription : ${unsub}\n`;

  const result = await sendEmail({
    to: sub.email,
    subject,
    html,
    text,
  });

  if (result.sent) {
    await prisma.newsletterSubscriber.update({
      where: { id: sub.id },
      data: { welcomeSentAt: new Date() },
    });
  }
  return result;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.info(
      `[newsletter] RESEND_API_KEY absent — email non envoyé à ${opts.to} « ${opts.subject} »`
    );
    return { sent: false, reason: "no_provider" };
  }

  const { sendResendEmail } = await import("@/lib/resend-from");
  const sent = await sendResendEmail(opts);
  if (!sent.ok) {
    return { sent: false, reason: sent.error };
  }
  return { sent: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
