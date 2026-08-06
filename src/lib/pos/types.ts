export type PosVendor =
  | "zelty"
  | "cashpad"
  | "tiller"
  | "laddition"
  | "lightspeed"
  | "square"
  | "csv"
  | "custom"
  | "other";

export type PosCanonicalLine = {
  externalSku?: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  soldAt?: Date;
  externalOrderId?: string;
};

export type PosEventKind = "SALE" | "CANCEL" | "REFUND" | "UNKNOWN";

export type PosCanonicalSale = {
  externalOrderId?: string;
  soldAt?: Date;
  lines: PosCanonicalLine[];
  /** Raw snippet for debugging / samplePayload */
  samplePayload?: string;
  eventKind?: PosEventKind;
};

export type PosCsvColumnMap = {
  sku?: string[];
  name: string[];
  quantity?: string[];
  price?: string[];
  date?: string[];
  orderId?: string[];
};

export type PosDeliveryGuarantees = {
  atLeastOnce: true;
  exactlyOnce: false;
  ordered: false;
};

export type PosAdapter = {
  vendor: PosVendor;
  label: string;
  csvColumns: PosCsvColumnMap;
  normalizeWebhook(body: unknown): PosCanonicalSale;
  parseImportRows(rows: Record<string, string>[]): PosCanonicalLine[];
  /** ID événement POS si disponible (idempotence) */
  extractExternalEventId?(body: unknown): string | null;
  deliveryGuarantees?: PosDeliveryGuarantees;
};

export const POS_VENDOR_LABELS: Record<PosVendor, string> = {
  zelty: "Zelty",
  cashpad: "Cashpad",
  tiller: "Tiller / SumUp",
  laddition: "L'Addition",
  lightspeed: "Lightspeed",
  square: "Square",
  csv: "Export CSV / Excel",
  custom: "Autre caisse",
  other: "Autre",
};
