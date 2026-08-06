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
