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

function moneyAmount(v: unknown): number | undefined {
  const r = asRecord(v);
  if (r && "amount" in r) {
    const cents = pickNumber(r.amount);
    if (cents == null) return undefined;
    // Square Money.amount = plus petite unité (centimes)
    return cents / 100;
  }
  return pickNumber(v);
}

function normalizeSquare(body: unknown): PosCanonicalSale {
  const root = asRecord(body) ?? {};
  const data = asRecord(root.data) ?? root;
  const obj = asRecord(data.object) ?? data;
  const order =
    asRecord(obj.order) ??
    asRecord(obj.payment) ??
    asRecord(root.order) ??
    root;

  const cancel =
    isCancelPayload(root, data, order) ||
    /cancel/i.test(pickString(order.state, root.type) || "");

  const items =
    (Array.isArray(order.line_items) && order.line_items) ||
    (Array.isArray(order.lineItems) && order.lineItems) ||
    (Array.isArray(root.items) && root.items) ||
    [];

  if (!items.length && !cancel) return normalizeGenericItemsBody(body);

  const lines = [];
  for (const item of items) {
    const r = asRecord(item);
    if (!r) continue;
    const name = pickString(r.name, r.item_name, r.title);
    if (!name) continue;
    lines.push({
      externalSku: pickString(
        r.catalog_object_id,
        r.catalogObjectId,
        r.sku,
        r.uid,
        r.id
      ),
      name,
      quantity: Math.max(1, pickNumber(r.quantity) ?? 1),
      unitPrice: moneyAmount(r.base_price_money) ?? moneyAmount(r.total_money),
    });
  }

  return withEventMeta(
    {
      externalOrderId: extractOrderId(order, root) ?? undefined,
      lines,
      eventKind: cancel ? "CANCEL" : "SALE",
      soldAt: pickOccurredAt(order, root, data),
      samplePayload: JSON.stringify(body).slice(0, 2000),
    },
    [root, data, order]
  );
}

function extractSquareEventId(body: unknown): string | null {
  const root = asRecord(body) ?? {};
  const data = asRecord(root.data) ?? root;
  const obj = asRecord(data.object) ?? data;
  const order =
    asRecord(obj.order) ??
    asRecord(obj.payment) ??
    asRecord(root.order) ??
    root;
  const cancel =
    isCancelPayload(root, data, order) ||
    /cancel/i.test(pickString(order.state, root.type) || "");
  return makeExternalEventId(extractOrderId(order, root), cancel ? "CANCEL" : "SALE");
}

export const squareAdapter: PosAdapter = {
  vendor: "square",
  label: "Square",
  csvColumns: DEFAULT_CSV_COLUMNS,
  normalizeWebhook: normalizeSquare,
  parseImportRows: (rows) => linesFromMappedRows(rows, DEFAULT_CSV_COLUMNS),
  extractExternalEventId: extractSquareEventId,
  deliveryGuarantees: {
    atLeastOnce: true,
    exactlyOnce: false,
    ordered: false,
  },
};
