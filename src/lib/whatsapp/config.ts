export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
  );
}

/**
 * Config canal WhatsApp — coûts, batch, plafonds.
 */
function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  const n = Number.isFinite(raw) ? raw : fallback;
  return Math.min(max, Math.max(min, n));
}

export const WHATSAPP_BATCH_MINUTES = envInt(
  "WHATSAPP_BATCH_MINUTES",
  15,
  5,
  30
);

/** Messages automatisés comptés / tenant / jour (hors réponses session). */
export const WHATSAPP_DAILY_LIMIT = envInt(
  "WHATSAPP_DAILY_LIMIT_PER_TENANT",
  20,
  1,
  200
);

/** Estimation coût unitaire (centimes EUR) pour suivi Ops. */
export const WHATSAPP_COST_CENTS = (() => {
  const raw = Number(process.env.WHATSAPP_COST_CENTS_PER_MSG || 5);
  return Number.isFinite(raw) ? Math.max(0, raw) : 5;
})();

/** En prod, exiger un Content SID template pour les messages hors session. */
export function requireWhatsAppTemplates(): boolean {
  if (process.env.WHATSAPP_REQUIRE_TEMPLATES === "0") return false;
  return process.env.WHATSAPP_REQUIRE_TEMPLATES === "1";
}

export type WhatsAppPurpose =
  | "stock_recap"
  | "stock_alert"
  | "billing_dunning"
  | "test"
  | "session_reply"
  | "delivery"
  | "other";

/** Purposes soumis au plafond journalier tenant. */
export function countsTowardDailyLimit(purpose: WhatsAppPurpose): boolean {
  return (
    purpose === "stock_recap" ||
    purpose === "stock_alert" ||
    purpose === "billing_dunning" ||
    purpose === "test" ||
    purpose === "delivery" ||
    purpose === "other"
  );
}
