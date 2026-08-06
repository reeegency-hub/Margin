import type { PosAdapter, PosCanonicalSale, PosVendor } from "./types";

export type PosDeliveryGuarantees = {
  atLeastOnce: true;
  exactlyOnce: false;
  ordered: false;
};

export const DEFAULT_POS_DELIVERY: PosDeliveryGuarantees = {
  atLeastOnce: true,
  exactlyOnce: false,
  ordered: false,
};

export type PosAdapterWithMeta = PosAdapter & {
  extractExternalEventId?: (body: unknown) => string | null;
  deliveryGuarantees?: PosDeliveryGuarantees;
};

export function resolveExternalEventId(
  adapter: PosAdapterWithMeta,
  body: unknown,
  sale: PosCanonicalSale,
  connectionId: string,
  hashSaleFingerprint: (opts: {
    connectionId: string;
    lines: PosCanonicalSale["lines"];
    occurredAt?: Date | null;
    externalOrderId?: string | null;
  }) => string
): string {
  const fromAdapter = adapter.extractExternalEventId?.(body)?.trim();
  if (fromAdapter) {
    return fromAdapter;
  }
  const orderId = sale.externalOrderId?.trim();
  if (orderId) {
    return sale.eventKind === "CANCEL" ? `cancel:${orderId}` : orderId;
  }
  const fp = hashSaleFingerprint({
    connectionId,
    lines: sale.lines,
    occurredAt: sale.soldAt ?? null,
    externalOrderId: sale.externalOrderId ?? null,
  });
  return sale.eventKind === "CANCEL" ? `cancel:${fp}` : fp;
}

export function vendorGuarantees(vendor: PosVendor): PosDeliveryGuarantees {
  void vendor;
  return DEFAULT_POS_DELIVERY;
}
