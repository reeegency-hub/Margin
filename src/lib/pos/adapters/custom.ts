import type { PosAdapter, PosCanonicalSale } from "../types";
import {
  DEFAULT_CSV_COLUMNS,
  asRecord,
  linesFromMappedRows,
  normalizeGenericItemsBody,
} from "../helpers";
import {
  extractOrderId,
  isCancelPayload,
  makeExternalEventId,
  withEventMeta,
} from "../event-detect";

function normalizeCustom(body: unknown): PosCanonicalSale {
  const root = asRecord(body) ?? {};
  const sale = normalizeGenericItemsBody(body);
  const cancel = isCancelPayload(root, asRecord(root.order));
  return withEventMeta(
    {
      ...sale,
      eventKind: cancel ? "CANCEL" : "SALE",
    },
    [root, asRecord(root.order)]
  );
}

function extractCustomEventId(body: unknown): string | null {
  const root = asRecord(body) ?? {};
  const order = asRecord(root.order);
  const cancel = isCancelPayload(root, order);
  return makeExternalEventId(
    extractOrderId(order, root),
    cancel ? "CANCEL" : "SALE"
  );
}

export const customAdapter: PosAdapter = {
  vendor: "custom",
  label: "Autre caisse",
  csvColumns: DEFAULT_CSV_COLUMNS,
  normalizeWebhook: normalizeCustom,
  parseImportRows: (rows) => linesFromMappedRows(rows, DEFAULT_CSV_COLUMNS),
  extractExternalEventId: extractCustomEventId,
  deliveryGuarantees: {
    atLeastOnce: true,
    exactlyOnce: false,
    ordered: false,
  },
};

export const otherAdapter: PosAdapter = {
  ...customAdapter,
  vendor: "other",
  label: "Autre",
};

export const csvAdapter: PosAdapter = {
  ...customAdapter,
  vendor: "csv",
  label: "Export CSV / Excel",
};
