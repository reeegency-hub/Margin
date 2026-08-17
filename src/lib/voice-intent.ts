export type VoiceItem = {
  name: string;
  quantity: number;
  unit: "g" | "ml" | "pcs" | "kg" | "l";
};

export type VoiceIntent =
  | { type: "inventory"; items: VoiceItem[] }
  | { type: "recipe"; dishName: string; items: VoiceItem[] }
  | { type: "unknown"; raw: string };

const UNIT_MAP: Record<string, VoiceItem["unit"]> = {
  g: "g",
  gramme: "g",
  grammes: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogramme: "kg",
  kilogrammes: "kg",
  ml: "ml",
  cl: "ml",
  litre: "l",
  litres: "l",
  l: "l",
  piece: "pcs",
  pieces: "pcs",
  pièce: "pcs",
  pièces: "pcs",
  pcs: "pcs",
  unite: "pcs",
  unités: "pcs",
};

function normalizeUnit(raw: string): VoiceItem["unit"] {
  const key = raw.toLowerCase().replace(/[éèê]/g, "e").trim();
  return UNIT_MAP[key] ?? "g";
}

function parseQuantity(raw: string): number {
  const n = parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Parse French voice/text like "Tomates 5 kilos, Salade 2 kg" or "Burger : 150 g bœuf, 1 pain" */
export function parseVoiceIntent(text: string): VoiceIntent {
  const raw = text.trim();
  if (!raw) return { type: "unknown", raw };

  const recipeMatch = raw.match(/^(.+?)\s*[:]\s*(.+)$/i);
  if (recipeMatch) {
    const dishName = recipeMatch[1].trim();
    const items = parseItemList(recipeMatch[2]);
    if (items.length) return { type: "recipe", dishName, items };
  }

  const items = parseItemList(raw);
  if (items.length) return { type: "inventory", items };

  return { type: "unknown", raw };
}

function parseItemList(segment: string): VoiceItem[] {
  const items: VoiceItem[] = [];
  const parts = segment.split(/[,;]|\bet\b/gi).map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const match =
      part.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|cl|pièces?|pieces?|pcs?|unités?|grammes?|kilos?|litres?)?$/i) ||
      part.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|cl|pièces?|pieces?|pcs?|unités?|grammes?|kilos?|litres?)?\s+(.+)$/i);

    if (!match) continue;

    if (/^\d/.test(match[1])) {
      const qty = parseQuantity(match[1]);
      const unit = normalizeUnit(match[2] || "pcs");
      const name = match[3].trim();
      if (name && qty > 0) items.push({ name, quantity: qty, unit });
    } else {
      const name = match[1].trim();
      const qty = parseQuantity(match[2]);
      const unit = normalizeUnit(match[3] || "pcs");
      if (name && qty > 0) items.push({ name, quantity: qty, unit });
    }
  }

  return items;
}

const FR_NUM: Record<string, number> = {
  un: 1,
  une: 1,
  uns: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
};

function foldFr(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * « deux lait et un pain », « 3 baguettes », « j’ai vendu un café »
 */
export function parseSpokenSale(
  text: string
): { name: string; quantity: number }[] {
  const cleaned = text
    .replace(
      /^(j[’']ai\s+)?(vendu|vente|ajouter?|ajoute|encore)\s+/i,
      ""
    )
    .trim();
  const parts = cleaned
    .split(/[,;]|\bet\s+|\spuis\s+/gi)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: { name: string; quantity: number }[] = [];
  for (const part of parts) {
    const folded = foldFr(part);
    const mNum =
      folded.match(/^(\d+)\s+(.+)$/) ||
      folded.match(
        /^(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\s+(.+)$/
      );
    if (mNum) {
      const qty = /^\d+$/.test(mNum[1])
        ? Number(mNum[1])
        : FR_NUM[mNum[1]] || 1;
      const name = mNum[2].replace(/\b(pieces?|unites?|pcs)\b/g, "").trim();
      if (name && qty > 0) out.push({ name, quantity: Math.floor(qty) });
      continue;
    }
    if (folded.length >= 2) out.push({ name: folded, quantity: 1 });
  }
  return out;
}

export function matchSpokenToCatalog<T extends { id: string; name: string; sku?: string | null }>(
  spoken: { name: string; quantity: number }[],
  catalog: T[]
): { matched: { product: T; quantity: number }[]; unknown: string[] } {
  const matched: { product: T; quantity: number }[] = [];
  const unknown: string[] = [];

  for (const item of spoken) {
    const q = foldFr(item.name);
    if (!q) continue;
    let best: T | null = null;
    let bestScore = 0;
    for (const p of catalog) {
      const n = foldFr(p.name);
      const sku = foldFr(p.sku || "");
      let score = 0;
      if (n === q || sku === q) score = 100;
      else if (n.includes(q) || q.includes(n) || (sku && sku.includes(q)))
        score = 80;
      else {
        const qt = q.split(" ").filter((t) => t.length > 1);
        const nt = n.split(" ");
        const hits = qt.filter((t) =>
          nt.some((w) => w.startsWith(t) || t.startsWith(w))
        );
        if (qt.length && hits.length === qt.length) score = 70;
        else if (hits.length) score = 40 + hits.length * 10;
      }
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best && bestScore >= 40) {
      const existing = matched.find((m) => m.product.id === best!.id);
      if (existing) existing.quantity += item.quantity;
      else matched.push({ product: best, quantity: item.quantity });
    } else {
      unknown.push(item.name);
    }
  }
  return { matched, unknown };
}

export function formatVoiceIntentSummary(intent: VoiceIntent): string {
  if (intent.type === "unknown") return intent.raw;
  if (intent.type === "recipe") {
    const lines = intent.items.map(
      (i) => `• ${i.name}: ${i.quantity} ${i.unit}`
    );
    return `Recette « ${intent.dishName} »\n${lines.join("\n")}`;
  }
  return intent.items
    .map((i) => `• ${i.name}: ${i.quantity} ${i.unit}`)
    .join("\n");
}
