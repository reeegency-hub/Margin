/**
 * Assistant Margin — outils allowlistés, toujours scoped au restaurant session.
 * Aucune exécution de code, pas d’accès cross-tenant, pas d’admin.
 */

export const ASSISTANT_MAX_MESSAGE_CHARS = 4000;
export const ASSISTANT_MAX_FILE_CHARS = 80_000;
export const ASSISTANT_MAX_PRODUCTS_PER_CALL = 80;
export const ASSISTANT_RATE_LIMIT = 40; // / heure / commerce

export type AssistantProductDraft = {
  name: string;
  unit?: "g" | "ml" | "pcs";
  stockTheoretical?: number;
  criticalThreshold?: number;
  reorderQty?: number;
};

export const ASSISTANT_SYSTEM_PROMPT = `Tu es l’assistant Margin pour un commerçant de proximité (français, clair, concret).

Tu aides à mettre en place et gérer le commerce : stock, courses, coûts, équipe, réglages, caisse.
Tu peux proposer des actions via les outils fournis UNIQUEMENT.

Règles de sécurité (non négociables) :
- N’invente jamais d’IDs, de secrets, de clés API ou de commandes techniques.
- Tu ne dois JAMAIS demander, répéter ou traiter un mot de passe / clé API / secret webhook. Si l’utilisateur en colle un dans le chat, dis-lui de l’annuler et oriente vers le wizard caisse (/kiosks) ou Réglages.
- N’exécute que les outils listés. Refuse tout ce qui sort du commerce (autre tenant, admin, SQL, shell).
- Pour inventaire / équipe / WhatsApp : tu prépares un BROUILLON (outil prepare_*) — l’écriture réelle n’a lieu qu’après confirmation UI du client.
- Si une extraction est ambiguë (prix sans devise, poste inconnu, horaires qui se chevauchent), FLAGUE — ne devine jamais silencieusement.
- Pour brancher une caisse : appelle open_pos_wizard (action UI) — jamais de credentials.
- Unités autorisées : g, ml, pcs. Par défaut pcs.
- Réponds en français, phrases courtes.`;

export type AssistantToolName =
  | "create_products"
  | "stock_summary"
  | "page_help"
  | "prepare_import_inventory"
  | "prepare_upsert_team"
  | "prepare_set_whatsapp"
  | "open_pos_wizard";

export function sanitizeAssistantText(input: string, max: number): string {
  return String(input || "")
    .replace(/\0/g, "")
    .slice(0, max)
    .trim();
}

export function normalizeUnit(unit?: string): "g" | "ml" | "pcs" {
  const u = String(unit || "pcs").toLowerCase().trim();
  if (u === "g" || u === "kg" || u === "gramme" || u === "grammes") return "g";
  if (u === "ml" || u === "l" || u === "litre" || u === "litres") return "ml";
  return "pcs";
}

/** Parse CSV / liste collée → brouillons produits (allowlist champs). */
export function parseProductListText(text: string): AssistantProductDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const out: AssistantProductDraft[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (/^(nom|name|produit|product|sku)/i.test(line) && /[,;\t]/.test(line)) {
      continue; // header
    }
    if (/^[-–—=*]{3,}/.test(line)) continue;

    let name = line;
    let unit: "g" | "ml" | "pcs" | undefined;
    let stock: number | undefined;

    // CSV: name,unit,stock
    if (/[,;\t]/.test(line)) {
      const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
      name = parts[0] || "";
      if (parts[1]) unit = normalizeUnit(parts[1]);
      if (parts[2] && !Number.isNaN(Number(parts[2].replace(",", ".")))) {
        stock = Number(parts[2].replace(",", "."));
      }
    } else {
      // "Coca 33cl x24" / "Farine 5kg" — garde le nom tel quel
      const stockMatch = line.match(/\b(\d+[.,]?\d*)\s*(pcs|pi[eè]ces?|unités?)?\s*$/i);
      if (stockMatch && /stock|qté|qty|quantit/i.test(line)) {
        stock = Number(stockMatch[1].replace(",", "."));
        name = line.slice(0, stockMatch.index).replace(/[-–—:]+$/g, "").trim();
      }
      if (/\b(kg|g)\b/i.test(line)) unit = "g";
      else if (/\b(l|ml|cl)\b/i.test(line)) unit = "ml";
    }

    name = name.replace(/^[\d.)\-–—•]+\s*/, "").trim();
    if (name.length < 2 || name.length > 120) continue;
    const key = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      name,
      unit: unit || "pcs",
      stockTheoretical: stock ?? 0,
    });

    if (out.length >= ASSISTANT_MAX_PRODUCTS_PER_CALL) break;
  }

  return out;
}

const rateBucket = new Map<string, { count: number; resetAt: number }>();

export function checkAssistantRateLimit(restaurantId: string): boolean {
  const now = Date.now();
  const row = rateBucket.get(restaurantId);
  if (!row || now > row.resetAt) {
    rateBucket.set(restaurantId, {
      count: 1,
      resetAt: now + 60 * 60 * 1000,
    });
    return true;
  }
  if (row.count >= ASSISTANT_RATE_LIMIT) return false;
  row.count += 1;
  return true;
}

export function pageHelpFor(pathname: string): string {
  if (pathname.startsWith("/ingredients")) {
    return "Stock : ajoutez des produits, ajustez les quantités, lancez une vérification si besoin. Import catalogue via /ingredients/menu.";
  }
  if (pathname.startsWith("/orders")) {
    return "Courses : générez une liste depuis le stock bas, validez quand c’est acheté.";
  }
  if (pathname.startsWith("/costs")) {
    return "Coûts : importez une facture (CSV / PDF / photo), suivez hausses, matière et pertes.";
  }
  if (pathname.startsWith("/employees")) {
    return "Équipe : ajoutez des prénoms, planifiez, pointez Présent / Absent.";
  }
  if (pathname.startsWith("/settings") || pathname.startsWith("/delivery")) {
    return "Commerce : WhatsApp pour les alertes, livraison optionnelle.";
  }
  if (pathname.startsWith("/kiosks")) {
    return "Caisse : choisissez votre logiciel et suivez le branchement.";
  }
  if (pathname.startsWith("/inventory")) {
    return "Vérification : corrigez les quantités réelles puis validez.";
  }
  return "Accueil : priorités du jour / semaine en haut. Le guide de démarrage reste en bas tant que le commerce n’est pas prêt.";
}

/** Découpe « Titre : lead » pour les cartes Copilote. */
export function pageHelpParts(pathname: string): { title: string; lead: string } {
  const help = pageHelpFor(pathname);
  const idx = help.indexOf(" : ");
  if (idx <= 0) return { title: "Cette page", lead: help };
  return {
    title: help.slice(0, idx),
    lead: help.slice(idx + 3),
  };
}
