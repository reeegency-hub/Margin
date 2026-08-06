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

function normalizeLaddition(body: unknown): PosCanonicalSale {
  const root = asRecord(body) ?? {};
  const ticket = asRecord(root.ticket) ?? asRecord(root.addition) ?? root;
  const cancel = isCancelPayload(root, ticket);
  const items =
    (Array.isArray(ticket.articles) && ticket.articles) ||
    (Array.isArray(ticket.items) && ticket.items) ||
    (Array.isArray(root.items) && root.items) ||
    [];

  if (!items.length && !cancel) return normalizeGenericItemsBody(body);

  const lines = [];
  for (const item of items) {
    const r = asRecord(item);
    if (!r) continue;
    const name = pickString(r.libelle, r.name, r.label, r.designation);
    if (!name) continue;
    lines.push({
      externalSku: pickString(r.code, r.sku, r.ean, r.id),
      name,
      quantity: Math.max(1, pickNumber(r.quantite, r.quantity, r.qty) ?? 1),
      unitPrice: pickNumber(r.prix, r.price, r.montant),
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

function extractLadditionEventId(body: unknown): string | null {
  const root = asRecord(body) ?? {};
  const ticket = asRecord(root.ticket) ?? asRecord(root.addition) ?? root;
  return makeExternalEventId(
    extractOrderId(ticket, root),
    isCancelPayload(root, ticket) ? "CANCEL" : "SALE"
  );
}

const ladditionCsv = {
  ...DEFAULT_CSV_COLUMNS,
  name: ["libelle", "libellé", "designation", ...DEFAULT_CSV_COLUMNS.name],
  quantity: ["quantite", "quantité", ...DEFAULT_CSV_COLUMNS.quantity!],
  price: ["prix", "montant", ...DEFAULT_CSV_COLUMNS.price!],
  sku: ["code", "ean", ...DEFAULT_CSV_COLUMNS.sku!],
};

export const ladditionAdapter: PosAdapter = {
  vendor: "laddition",
  label: "L'Addition",
  csvColumns: ladditionCsv,
  normalizeWebhook: normalizeLaddition,
  parseImportRows: (rows) => linesFromMappedRows(rows, ladditionCsv),
  extractExternalEventId: extractLadditionEventId,
  deliveryGuarantees: {
    atLeastOnce: true,
    exactlyOnce: false,
    ordered: false,
  },
};
