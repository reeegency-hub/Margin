import { parseCsvText } from "@/lib/pos/csv";
import type { OpenAICallOptions } from "@/lib/menu-ai";
import { extractTextFromMenuFile } from "@/lib/menu-file-extract";

export type ProposedReceiptLine = {
  name: string;
  quantity: number;
  unitPrice: number | null;
  /** Matched stock product id, if any */
  ingredientId: string | null;
  matchName: string | null;
};

export type ProposedReceipt = {
  supplierName: string | null;
  note: string | null;
  lines: ProposedReceiptLine[];
  engine: "csv" | "openai" | "local";
};

export type IngredientMatch = {
  id: string;
  name: string;
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pickKey(row: Record<string, string>, aliases: string[]): string | null {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const hit = keys.find((k) => norm(k) === norm(a) || norm(k).includes(norm(a)));
    if (hit && row[hit]?.trim()) return row[hit].trim();
  }
  return null;
}

function parseNum(raw: string | null | undefined): number | null {
  if (raw == null || !String(raw).trim()) return null;
  const cleaned = String(raw)
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function matchIngredient(
  name: string,
  catalog: IngredientMatch[]
): IngredientMatch | null {
  const n = norm(name);
  if (!n) return null;
  const exact = catalog.find((c) => norm(c.name) === n);
  if (exact) return exact;
  const starts = catalog.find(
    (c) => norm(c.name).startsWith(n) || n.startsWith(norm(c.name))
  );
  if (starts) return starts;
  const includes = catalog.find(
    (c) => norm(c.name).includes(n) || n.includes(norm(c.name))
  );
  return includes || null;
}

function attachMatches(
  lines: Omit<ProposedReceiptLine, "ingredientId" | "matchName">[],
  catalog: IngredientMatch[]
): ProposedReceiptLine[] {
  return lines.map((l) => {
    const m = matchIngredient(l.name, catalog);
    return {
      ...l,
      ingredientId: m?.id ?? null,
      matchName: m?.name ?? null,
    };
  });
}

const NAME_ALIASES = [
  "produit",
  "product",
  "article",
  "name",
  "designation",
  "désignation",
  "libelle",
  "libellé",
  "label",
  "item",
];
const QTY_ALIASES = [
  "qte",
  "qty",
  "quantity",
  "quantite",
  "quantité",
  "qté",
  "nb",
];
const PRICE_ALIASES = [
  "prix",
  "price",
  "unitprice",
  "unit_price",
  "pu",
  "prix_unitaire",
  "prix unitaire",
  "p.u.",
  "montant unitaire",
];
const SUPPLIER_ALIASES = ["fournisseur", "supplier", "vendor"];
const NOTE_ALIASES = ["facture", "invoice", "n°", "numero", "numéro", "ref", "note"];

export function parseInvoiceCsv(
  text: string,
  catalog: IngredientMatch[]
): ProposedReceipt | null {
  const rows = parseCsvText(text);
  if (!rows.length) return null;

  const lines: Omit<ProposedReceiptLine, "ingredientId" | "matchName">[] = [];
  let supplierName: string | null = null;
  let note: string | null = null;

  for (const row of rows) {
    if (!supplierName) {
      supplierName = pickKey(row, SUPPLIER_ALIASES);
    }
    if (!note) {
      note = pickKey(row, NOTE_ALIASES);
    }
    const name = pickKey(row, NAME_ALIASES);
    if (!name) continue;
    const quantity = parseNum(pickKey(row, QTY_ALIASES)) ?? 0;
    const unitPrice = parseNum(pickKey(row, PRICE_ALIASES));
    if (quantity <= 0 && (unitPrice == null || unitPrice <= 0)) continue;
    lines.push({
      name,
      quantity: quantity > 0 ? quantity : 1,
      unitPrice: unitPrice != null && unitPrice > 0 ? unitPrice : null,
    });
  }

  if (!lines.length) return null;
  return {
    supplierName,
    note,
    lines: attachMatches(lines, catalog),
    engine: "csv",
  };
}

/** Heuristic: lines like "Tomates 5 2.40" or "Tomates;5;2,40" */
export function parseInvoiceTextLocal(
  text: string,
  catalog: IngredientMatch[]
): ProposedReceipt | null {
  const lines: Omit<ProposedReceiptLine, "ingredientId" | "matchName">[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line || line.length < 3) continue;
    if (/^(total|tva|ht|ttc|sous.?total)/i.test(line)) continue;

    const parts = line.split(/[;\t|]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const qty = parseNum(parts[parts.length - 2]);
      const price = parseNum(parts[parts.length - 1]);
      const name = parts.slice(0, -2).join(" ");
      if (name && qty != null && qty > 0) {
        lines.push({
          name,
          quantity: qty,
          unitPrice: price != null && price > 0 ? price : null,
        });
        continue;
      }
    }

    const m = line.match(
      /^(.+?)\s+([\d]+(?:[.,]\d+)?)\s+(?:x\s*)?([\d]+(?:[.,]\d+)?)\s*€?$/i
    );
    if (m) {
      const qty = parseNum(m[2]);
      const price = parseNum(m[3]);
      if (qty != null && qty > 0) {
        lines.push({
          name: m[1].trim(),
          quantity: qty,
          unitPrice: price != null && price > 0 ? price : null,
        });
      }
    }
  }
  if (!lines.length) return null;
  return {
    supplierName: null,
    note: null,
    lines: attachMatches(lines, catalog),
    engine: "local",
  };
}

async function parseInvoiceWithOpenAI(
  text: string,
  catalog: IngredientMatch[],
  options: OpenAICallOptions
): Promise<{ receipt: ProposedReceipt | null; error?: string }> {
  const apiKey = (options.apiKey || process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return { receipt: null };

  const model =
    (options.model || process.env.OPENAI_MODEL || "gpt-4o-mini").trim() ||
    "gpt-4o-mini";

  const catalogHint = catalog
    .slice(0, 80)
    .map((c) => c.name)
    .join(", ");

  const payload = {
    model,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system" as const,
        content:
          "Tu extrais les lignes d'une facture fournisseur (commerce de détail). Réponds en JSON strict: {\"supplierName\":string|null,\"note\":string|null,\"lines\":[{\"name\":string,\"quantity\":number,\"unitPrice\":number|null}]}. quantity = quantité reçue, unitPrice = prix d'achat unitaire HT si dispo. Ignore totaux, TVA, frais de port.",
      },
      {
        role: "user" as const,
        content: `Catalogue stock (pour coller aux noms): ${catalogHint || "(vide)"}\n\nFacture:\n${text.slice(0, 12000)}`,
      },
    ],
    max_tokens: 2500,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return {
      receipt: null,
      error: `Analyse IA impossible (${res.status}). Essayez un CSV.`,
    };
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = (data.choices?.[0]?.message?.content || "").trim();
  try {
    const parsed = JSON.parse(content) as {
      supplierName?: string | null;
      note?: string | null;
      lines?: { name?: string; quantity?: number; unitPrice?: number | null }[];
    };
    const rawLines = (parsed.lines || [])
      .map((l) => ({
        name: String(l.name || "").trim(),
        quantity: Number(l.quantity) || 0,
        unitPrice:
          l.unitPrice != null && Number(l.unitPrice) > 0
            ? Number(l.unitPrice)
            : null,
      }))
      .filter((l) => l.name && l.quantity > 0);
    if (!rawLines.length) return { receipt: null };
    return {
      receipt: {
        supplierName: parsed.supplierName?.trim() || null,
        note: parsed.note?.trim() || null,
        lines: attachMatches(rawLines, catalog),
        engine: "openai",
      },
    };
  } catch {
    return { receipt: null, error: "Réponse IA illisible." };
  }
}

export async function analyzeInvoiceFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  catalog: IngredientMatch[],
  options: OpenAICallOptions = {}
): Promise<
  | { ok: true; receipt: ProposedReceipt; extractedText?: string }
  | { ok: false; error: string }
> {
  const lower = fileName.toLowerCase();
  const isCsv =
    mimeType.includes("csv") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".tsv") ||
    mimeType === "text/plain" ||
    lower.endsWith(".txt");

  if (isCsv || lower.endsWith(".txt")) {
    const text = buffer.toString("utf8");
    const csv = parseInvoiceCsv(text, catalog);
    if (csv) return { ok: true, receipt: csv, extractedText: text };
    const local = parseInvoiceTextLocal(text, catalog);
    if (local) return { ok: true, receipt: local, extractedText: text };
    // fall through to AI on plain text
    const ai = await parseInvoiceWithOpenAI(text, catalog, options);
    if (ai.receipt) return { ok: true, receipt: ai.receipt, extractedText: text };
    return {
      ok: false,
      error:
        ai.error ||
        "Aucune ligne détectée. CSV attendu : produit ; qté ; prix.",
    };
  }

  // Reuse extract, then AI / local on text. For images, tweak via extract then AI.
  const extracted = await extractTextFromMenuFile(
    buffer,
    mimeType,
    fileName,
    options
  );
  if (!extracted.ok) {
    return {
      ok: false,
      error: extracted.error
        .replace(/menu/gi, "facture")
        .replace(/plat/gi, "ligne"),
    };
  }

  const ai = await parseInvoiceWithOpenAI(extracted.text, catalog, options);
  if (ai.receipt) {
    return { ok: true, receipt: ai.receipt, extractedText: extracted.text };
  }
  const local = parseInvoiceTextLocal(extracted.text, catalog);
  if (local) {
    return { ok: true, receipt: local, extractedText: extracted.text };
  }
  return {
    ok: false,
    error:
      ai.error ||
      "Aucune ligne de facture détectée. Préférez un export CSV fournisseur.",
  };
}
