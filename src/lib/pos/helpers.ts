import type { PosCanonicalLine, PosCanonicalSale, PosCsvColumnMap } from "./types";

export function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

export function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

export function pickNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.replace(",", ".").replace(/\s/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export function normalizePosName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function posDedupeKey(line: {
  externalSku?: string;
  name: string;
}): string {
  const sku = line.externalSku?.trim();
  if (sku) return `sku:${sku.toLowerCase()}`;
  return `name:${normalizePosName(line.name)}`;
}

function findCol(
  row: Record<string, string>,
  aliases: string[] | undefined
): string | undefined {
  if (!aliases?.length) return undefined;
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const want = alias.toLowerCase();
    const hit = keys.find((k) => k.toLowerCase().trim() === want);
    if (hit && row[hit]?.trim()) return row[hit].trim();
  }
  // fuzzy: header contains alias
  for (const alias of aliases) {
    const want = alias.toLowerCase();
    const hit = keys.find((k) => k.toLowerCase().includes(want));
    if (hit && row[hit]?.trim()) return row[hit].trim();
  }
  return undefined;
}

export function linesFromMappedRows(
  rows: Record<string, string>[],
  map: PosCsvColumnMap
): PosCanonicalLine[] {
  const out: PosCanonicalLine[] = [];
  for (const row of rows) {
    const name = findCol(row, map.name);
    if (!name) continue;
    const sku = findCol(row, map.sku);
    const qtyRaw = findCol(row, map.quantity);
    const priceRaw = findCol(row, map.price);
    const qty = pickNumber(qtyRaw) ?? 1;
    const unitPrice = pickNumber(priceRaw);
    out.push({
      externalSku: sku,
      name,
      quantity: Math.max(0.001, qty),
      unitPrice,
    });
  }
  return out;
}

/** Shared items[] shape used by custom + most French POS webhooks */
export function normalizeGenericItemsBody(body: unknown): PosCanonicalSale {
  const root = asRecord(body) ?? {};
  const itemsRaw =
    (Array.isArray(root.items) && root.items) ||
    (Array.isArray(root.lines) && root.lines) ||
    (Array.isArray(root.line_items) && root.line_items) ||
    (Array.isArray(root.products) && root.products) ||
    [];

  const lines: PosCanonicalLine[] = [];
  for (const item of itemsRaw) {
    const r = asRecord(item);
    if (!r) continue;
    const name = pickString(
      r.dishName,
      r.name,
      r.label,
      r.product_name,
      r.productName,
      r.title,
      r.item_name
    );
    if (!name) continue;
    const sku = pickString(
      r.sku,
      r.externalSku,
      r.external_sku,
      r.product_id,
      r.productId,
      r.id,
      r.barcode,
      r.ean
    );
    const quantity = pickNumber(r.quantity, r.qty, r.count) ?? 1;
    const unitPrice = pickNumber(
      r.unitPrice,
      r.unit_price,
      r.price,
      r.amount,
      r.total
    );
    lines.push({
      externalSku: sku,
      name,
      quantity: Math.max(1, quantity),
      unitPrice,
    });
  }

  return {
    externalOrderId: pickString(
      root.externalOrderId,
      root.external_order_id,
      root.order_id,
      root.orderId,
      root.id,
      root.ticket_id,
      root.ticketId
    ),
    soldAt: (() => {
      const d = pickString(root.soldAt, root.sold_at, root.date, root.created_at);
      if (!d) return undefined;
      const parsed = new Date(d);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    })(),
    lines,
    samplePayload: JSON.stringify(body).slice(0, 2000),
  };
}

export const DEFAULT_CSV_COLUMNS: PosCsvColumnMap = {
  sku: ["sku", "ean", "barcode", "code", "référence", "reference", "id produit", "product_id"],
  name: ["name", "nom", "produit", "product", "libellé", "libelle", "item", "dish", "article"],
  quantity: ["quantity", "qty", "qté", "qte", "quantité", "quantite", "count", "nb"],
  price: ["price", "prix", "unit_price", "unitprice", "montant", "amount", "ttc"],
  date: ["date", "sold_at", "created_at", "jour"],
  orderId: ["order_id", "ticket", "commande", "external_order_id"],
};
