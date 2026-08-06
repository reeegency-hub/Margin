import type { PosAdapter, PosCanonicalSale } from "../types";
import {
  DEFAULT_CSV_COLUMNS,
  asRecord,
  linesFromMappedRows,
  normalizeGenericItemsBody,
  pickNumber,
  pickString,
} from "../helpers";

function pickOccurredAt(order: Record<string, unknown>, root: Record<string, unknown>) {
  const raw =
    pickString(
      order.created_at,
      order.date,
      order.ordered_at,
      order.closed_at,
      root.created_at,
      root.date
    ) || null;
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Zelty-like: order.dishs / items with id + name + quantity + price */
function normalizeZelty(body: unknown): PosCanonicalSale {
  const root = asRecord(body) ?? {};
  const order = asRecord(root.order) ?? root;
  const items =
    (Array.isArray(order.dishs) && order.dishs) ||
    (Array.isArray(order.dishes) && order.dishes) ||
    (Array.isArray(order.items) && order.items) ||
    (Array.isArray(root.items) && root.items) ||
    [];

  if (!items.length) return normalizeGenericItemsBody(body);

  const lines = [];
  for (const item of items) {
    const r = asRecord(item);
    if (!r) continue;
    const name = pickString(r.name, r.label, r.dish_name);
    if (!name) continue;
    lines.push({
      externalSku: pickString(r.id, r.sku, r.idl, r.product_id),
      name,
      quantity: Math.max(1, pickNumber(r.quantity, r.qty, r.count) ?? 1),
      unitPrice: pickNumber(r.price, r.unit_price, r.price_ttc),
    });
  }

  return {
    externalOrderId: pickString(order.id, order.order_id, root.id, root.order_id),
    soldAt: pickOccurredAt(order, root),
    lines,
    samplePayload: JSON.stringify(body).slice(0, 2000),
  };
}

function extractZeltyEventId(body: unknown): string | null {
  const root = asRecord(body) ?? {};
  const order = asRecord(root.order) ?? root;
  return (
    pickString(
      order.id,
      order.order_id,
      root.id,
      root.order_id,
      root.event_id
    ) || null
  );
}

const zeltyCsv = {
  ...DEFAULT_CSV_COLUMNS,
  sku: ["id", "sku", "idl", "product_id", "ean", ...DEFAULT_CSV_COLUMNS.sku!],
  name: ["name", "nom", "dish", "produit", ...DEFAULT_CSV_COLUMNS.name],
};

export const zeltyAdapter: PosAdapter = {
  vendor: "zelty",
  label: "Zelty",
  csvColumns: zeltyCsv,
  normalizeWebhook: normalizeZelty,
  parseImportRows: (rows) => linesFromMappedRows(rows, zeltyCsv),
  extractExternalEventId: extractZeltyEventId,
  deliveryGuarantees: {
    atLeastOnce: true,
    exactlyOnce: false,
    ordered: false,
  },
};
