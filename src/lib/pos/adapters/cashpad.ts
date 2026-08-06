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

function normalizeCashpad(body: unknown): PosCanonicalSale {
  const root = asRecord(body) ?? {};
  const ticket = asRecord(root.ticket) ?? asRecord(root.data) ?? root;
  const cancel = isCancelPayload(root, ticket);
  const items =
    (Array.isArray(ticket.lines) && ticket.lines) ||
    (Array.isArray(ticket.items) && ticket.items) ||
    (Array.isArray(root.items) && root.items) ||
    [];

  if (!items.length && !cancel) return normalizeGenericItemsBody(body);

  const lines = [];
  for (const item of items) {
    const r = asRecord(item);
    if (!r) continue;
    const product = asRecord(r.product) ?? r;
    const name = pickString(product.name, product.label, r.name, r.label);
    if (!name) continue;
    lines.push({
      externalSku: pickString(
        product.sku,
        product.barcode,
        product.id,
        r.sku,
        r.barcode
      ),
      name,
      quantity: Math.max(1, pickNumber(r.quantity, r.qty) ?? 1),
      unitPrice: pickNumber(r.unit_price, r.price, product.price),
    });
  }

  return withEventMeta(
    {
      externalOrderId: extractOrderId(ticket, root) ?? undefined,
      lines,
      eventKind: cancel ? "CANCEL" : "SALE",
      soldAt: pickOccurredAt(ticket, root),
      samplePayload: JSON.stringify(body).slice(0, 2000),
    },
    [root, ticket]
  );
}

function extractCashpadEventId(body: unknown): string | null {
  const root = asRecord(body) ?? {};
  const ticket = asRecord(root.ticket) ?? asRecord(root.data) ?? root;
  const id = extractOrderId(ticket, root);
  return makeExternalEventId(
    id,
    isCancelPayload(root, ticket) ? "CANCEL" : "SALE"
  );
}

export const cashpadAdapter: PosAdapter = {
  vendor: "cashpad",
  label: "Cashpad",
  csvColumns: DEFAULT_CSV_COLUMNS,
  normalizeWebhook: normalizeCashpad,
  parseImportRows: (rows) => linesFromMappedRows(rows, DEFAULT_CSV_COLUMNS),
  extractExternalEventId: extractCashpadEventId,
  deliveryGuarantees: {
    atLeastOnce: true,
    exactlyOnce: false,
    ordered: false,
  },
};
