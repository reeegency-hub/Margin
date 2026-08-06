import type { PosAdapter, PosCanonicalSale } from "../types";
import {
  DEFAULT_CSV_COLUMNS,
  asRecord,
  linesFromMappedRows,
  normalizeGenericItemsBody,
  pickNumber,
  pickString,
} from "../helpers";
import {
  extractOrderId,
  isCancelPayload,
  makeExternalEventId,
  pickOccurredAt,
  withEventMeta,
} from "../event-detect";

function normalizeTiller(body: unknown): PosCanonicalSale {
  const root = asRecord(body) ?? {};
  const data = asRecord(root.data) ?? root;
  const cancel = isCancelPayload(root, data);
  const items =
    (Array.isArray(data.order_items) && data.order_items) ||
    (Array.isArray(data.items) && data.items) ||
    (Array.isArray(root.items) && root.items) ||
    [];

  if (!items.length && !cancel) return normalizeGenericItemsBody(body);

  const lines = [];
  for (const item of items) {
    const r = asRecord(item);
    if (!r) continue;
    const name = pickString(r.name, r.product_name, r.title, r.label);
    if (!name) continue;
    lines.push({
      externalSku: pickString(r.sku, r.product_id, r.id, r.barcode),
      name,
      quantity: Math.max(1, pickNumber(r.quantity, r.qty) ?? 1),
      unitPrice: pickNumber(r.price, r.unit_price, r.amount),
    });
  }

  return withEventMeta(
    {
      externalOrderId: extractOrderId(data, root) ?? undefined,
      lines,
      eventKind: cancel ? "CANCEL" : "SALE",
      soldAt: pickOccurredAt(data, root),
      samplePayload: JSON.stringify(body).slice(0, 2000),
    },
    [root, data]
  );
}

function extractTillerEventId(body: unknown): string | null {
  const root = asRecord(body) ?? {};
  const data = asRecord(root.data) ?? root;
  return makeExternalEventId(
    extractOrderId(data, root),
    isCancelPayload(root, data) ? "CANCEL" : "SALE"
  );
}

export const tillerAdapter: PosAdapter = {
  vendor: "tiller",
  label: "Tiller / SumUp",
  csvColumns: DEFAULT_CSV_COLUMNS,
  normalizeWebhook: normalizeTiller,
  parseImportRows: (rows) => linesFromMappedRows(rows, DEFAULT_CSV_COLUMNS),
  extractExternalEventId: extractTillerEventId,
  deliveryGuarantees: {
    atLeastOnce: true,
    exactlyOnce: false,
    ordered: false,
  },
};
