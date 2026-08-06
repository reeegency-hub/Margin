/**
 * Templates WhatsApp Business (Twilio Content API).
 *
 * Processus de validation (avant prod) :
 * 1. Meta Business Manager / Twilio Content Template Builder
 * 2. Créer le template (catégorie UTILITY pour alertes stock / facturation)
 * 3. Soumettre → attendre APPROVED
 * 4. Copier le Content SID (`HX…`) dans les env Vercel
 * 5. Tester en sandbox puis sur 1 tenant pilote
 * 6. Activer WHATSAPP_REQUIRE_TEMPLATES=1 si besoin de forcer
 *
 * Voir WHATSAPP_ALERTS.md
 */
import type { WhatsAppPurpose } from "@/lib/whatsapp/config";

export type TemplateDef = {
  key: string;
  purpose: WhatsAppPurpose;
  /** Twilio Content SID HX… */
  contentSid: string | null;
  /** Noms des variables pour la doc / mapping */
  variables: string[];
  /** Corps de secours (dev / console) — miroir du texte approuvé */
  fallbackBody: (vars: Record<string, string>) => string;
};

function envSid(name: string): string | null {
  const v = process.env[name]?.trim();
  return v || null;
}

export const WHATSAPP_TEMPLATES: Record<string, TemplateDef> = {
  stock_recap: {
    key: "stock_recap",
    purpose: "stock_recap",
    contentSid: envSid("TWILIO_WA_TEMPLATE_STOCK_RECAP"),
    variables: ["1", "2", "3"], // magasin, nb produits, liste
    fallbackBody: (v) =>
      [
        `Margin — Récap rupture de stock`,
        `${v["1"] || "Magasin"} · ${v["2"] || "0"} produit(s)`,
        v["3"] || "",
        `→ Une seule liste à traiter.`,
      ]
        .filter(Boolean)
        .join("\n"),
  },
  stock_alert: {
    key: "stock_alert",
    purpose: "stock_alert",
    contentSid: envSid("TWILIO_WA_TEMPLATE_STOCK_ALERT"),
    variables: ["1", "2", "3"], // produit, constat, action
    fallbackBody: (v) =>
      [
        `Margin — Alerte stock`,
        v["1"] || "",
        v["2"] || "",
        v["3"] ? `→ ${v["3"]}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
  },
  billing_dunning: {
    key: "billing_dunning",
    purpose: "billing_dunning",
    contentSid: envSid("TWILIO_WA_TEMPLATE_BILLING_DUNNING"),
    variables: ["1", "2", "3"], // montant, date grâce, url portail
    fallbackBody: (v) =>
      `Margin — échec de paiement (${v["1"] || "abonnement"}). ` +
      `Mettez à jour votre carte avant le ${v["2"] || ""} : ${v["3"] || ""}`,
  },
  test: {
    key: "test",
    purpose: "test",
    contentSid: envSid("TWILIO_WA_TEMPLATE_TEST"),
    variables: ["1"],
    fallbackBody: (v) =>
      v["1"] || "Margin — message de test. Votre numéro est bien relié.",
  },
};

export function resolveTemplate(
  key: string
): TemplateDef | null {
  return WHATSAPP_TEMPLATES[key] || null;
}

export function templateSidForPurpose(
  purpose: WhatsAppPurpose
): string | null {
  const match = Object.values(WHATSAPP_TEMPLATES).find(
    (t) => t.purpose === purpose
  );
  return match?.contentSid ?? null;
}
