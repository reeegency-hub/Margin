/**
 * Garde-fous prod vs CI locale.
 * Usage: npm run check:prod-env
 *
 * Échoue en CI si DATABASE_URL pointe encore vers SQLite alors que
 * VERCEL_ENV=production, ou si CRON_SECRET est vide en prod.
 * Échoue si DEMO_AUTO_LOGIN=1 en prod.
 * En prod : Stripe (secret + prices + webhook) obligatoire si self-serve.
 */
const url = process.env.DATABASE_URL || "";
const cron = process.env.CRON_SECRET || "";
const demo = process.env.DEMO_AUTO_LOGIN || "";
const nextAuthUrl = process.env.NEXTAUTH_URL || "";
const nextAuthSecret = process.env.NEXTAUTH_SECRET || "";
const adminEmails = process.env.ADMIN_EMAILS || "";
const vercelEnv = process.env.VERCEL_ENV || "";
const nodeEnv = process.env.NODE_ENV || "";
const pretendProd =
  process.env.CHECK_AS_PROD === "1" ||
  vercelEnv === "production" ||
  (nodeEnv === "production" && !process.env.ALLOW_SQLITE_PROD);

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim() || "";
const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
const stripePrices = [
  process.env.STRIPE_PRICE_COMMERCE_MONTHLY,
  process.env.STRIPE_PRICE_COMMERCE_YEARLY,
  process.env.STRIPE_PRICE_RESEAU_MONTHLY,
  process.env.STRIPE_PRICE_RESEAU_YEARLY,
].map((v) => (v || "").trim());
const resendKey = process.env.RESEND_API_KEY?.trim() || "";
const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL?.trim() || "";
const webhookBase = process.env.WEBHOOK_BASE_URL?.trim() || "";

const errors: string[] = [];
const warns: string[] = [];

const isSqlite =
  url.startsWith("file:") ||
  url.includes("sqlite") ||
  url.endsWith(".db");

if (pretendProd) {
  if (isSqlite || !url) {
    errors.push(
      "DATABASE_URL doit être Postgres en production (SQLite / vide interdit)."
    );
  }
  if (!cron) {
    errors.push("CRON_SECRET obligatoire en production (crons sinon ouverts).");
  }
  if (demo === "1") {
    errors.push(
      "DEMO_AUTO_LOGIN=1 interdit en production (session démo sans mot de passe)."
    );
  }
  if (!nextAuthSecret) {
    errors.push("NEXTAUTH_SECRET obligatoire en production.");
  }
  if (!nextAuthUrl) {
    warns.push("NEXTAUTH_URL vide — sessions / callbacks peuvent casser.");
  } else if (
    !nextAuthUrl.startsWith("https://") ||
    nextAuthUrl.includes("localhost")
  ) {
    warns.push(
      "NEXTAUTH_URL devrait être l’URL publique HTTPS (ex. https://margin-shop.vercel.app)."
    );
  }
  if (!webhookBase) {
    warns.push("WEBHOOK_BASE_URL vide — webhooks POS / Twilio peuvent renvoyer une mauvaise URL.");
  }
  if (!adminEmails) {
    warns.push(
      "ADMIN_EMAILS vide — seul reeegency@gmail.com a l’accès fondateur."
    );
  }

  // Self-serve billing
  if (!stripeSecret) {
    errors.push(
      "STRIPE_SECRET_KEY obligatoire en production (self-serve / checkout)."
    );
  } else {
    if (!stripeWebhook) {
      errors.push(
        "STRIPE_WEBHOOK_SECRET obligatoire — sans lui les paiements n’activent pas le magasin."
      );
    }
    const missingPrices = [
      "STRIPE_PRICE_COMMERCE_MONTHLY",
      "STRIPE_PRICE_COMMERCE_YEARLY",
      "STRIPE_PRICE_RESEAU_MONTHLY",
      "STRIPE_PRICE_RESEAU_YEARLY",
    ].filter((_, i) => !stripePrices[i]);
    if (missingPrices.length) {
      errors.push(
        `Prix Stripe manquants : ${missingPrices.join(", ")}.`
      );
    }
    if (!process.env.STRIPE_COUPON_AFFILIATE?.trim()) {
      warns.push(
        "STRIPE_COUPON_AFFILIATE vide — le code créera/réutilisera margin_ref_20_once au 1er checkout affilié."
      );
    }
  }

  if (!resendKey) {
    warns.push(
      "RESEND_API_KEY vide — OTP email signup + dunning email + newsletter indisponibles."
    );
  }
  if (!calendly) {
    warns.push(
      "NEXT_PUBLIC_CALENDLY_URL vide — widget démo landing (#demo) vide."
    );
  }
} else {
  if (isSqlite) {
    warns.push(
      "DATABASE_URL = SQLite — OK en local ; prod Vercel doit être Postgres."
    );
  }
  if (!cron) {
    warns.push("CRON_SECRET vide — OK en local ; requis dès le déploiement.");
  }
  if (demo === "1") {
    warns.push("DEMO_AUTO_LOGIN=1 — à désactiver avant prod.");
  }
  if (stripeSecret && !stripeWebhook) {
    warns.push("STRIPE_WEBHOOK_SECRET vide — à poser avant self-serve.");
  }
}

for (const w of warns) console.warn("[check:prod-env]", w);
if (errors.length) {
  for (const e of errors) console.error("[check:prod-env]", e);
  process.exit(1);
}

console.log("[check:prod-env] ok");
