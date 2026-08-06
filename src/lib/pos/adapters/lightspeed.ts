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

function normalizeLightspeed(body: unknown): PosCanonicalSale {
  const root = asRecord(body) ?? {};
  const sale = asRecord(root.Sale) ?? asRecord(root.sale) ?? root;
  const cancel = isCancelPayload(root, sale);
  const linesRaw =
    (Array.isArray(sale.SaleLines) && sale.SaleLines) ||
    (Array.isArray(sale.saleLines) && sale.saleLines) ||
    (Array.isArray(root.items) && root.items) ||
    [];

  if (!linesRaw.length && !cancel) return normalizeGenericItemsBody(body);

  const lines = [];
  for (const item of linesRaw) {
    const r = asRecord(item) ?? {};
    const line = asRecord(r.SaleLine) ?? asRecord(r.saleLine) ?? r;
    const itemObj = asRecord(line.Item) ?? asRecord(line.item) ?? line;
    const name = pickString(
      itemObj.description,
      itemObj.name,
      line.description,
      line.name
    );
    if (!name) continue;
    lines.push({
      externalSku: pickString(
        itemObj.customSku,
        itemObj.sku,
        itemObj.systemSku,
        itemObj.id,
        line.itemId
      ),
      name,
      quantity: Math.max(1, pickNumber(line.unitQuantity, line.quantity) ?? 1),
      unitPrice: pickNumber(line.unitPrice, line.price, itemObj.price),
    });
  }

  return withEventMeta(
    {
      externalOrderId: extractOrderId(sale, root) ?? undefined,
      lines,
      eventKind: cancel ? "CANCEL" : "SALE",
      soldAt: pickOccurredAt(sale, root),
      samplePayload: JSON.stringify(body).slice(0, 2000),
    },
    [root, sale]
  );
}

function extractLightspeedEventId(body: unknown): string | null {
  const root = asRecord(body) ?? {};
  const sale = asRecord(root.Sale) ?? asRecord(root.sale) ?? root;
  return makeExternalEventId(
    extractOrderId(sale, root),
    isCancelPayload(root, sale) ? "CANCEL" : "SALE"
  );
}

export const lightspeedAdapter: PosAdapter = {
  vendor: "lightspeed",
  label: "Lightspeed",
  csvColumns: DEFAULT_CSV_COLUMNS,
  normalizeWebhook: normalizeLightspeed,
  parseImportRows: (rows) => linesFromMappedRows(rows, DEFAULT_CSV_COLUMNS),
  extractExternalEventId: extractLightspeedEventId,
  deliveryGuarantees: {
    atLeastOnce: true,
    exactlyOnce: false,
    ordered: false,
  },
};
