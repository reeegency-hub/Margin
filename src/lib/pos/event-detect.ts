/**
 * Détection cancel / occurredAt partagée entre adapters caisse.
 */
import type { PosCanonicalSale, PosEventKind } from "./types";
import { asRecord, pickString } from "./helpers";

export function pickOccurredAt(
  ...sources: Array<Record<string, unknown> | null | undefined>
): Date | undefined {
  for (const src of sources) {
    if (!src) continue;
    const raw = pickString(
      src.created_at,
      src.createdAt,
      src.date,
      src.ordered_at,
      src.orderedAt,
      src.closed_at,
      src.closedAt,
      src.sold_at,
      src.soldAt,
      src.timestamp,
      src.time,
      src.completed_at,
      src.completedAt,
      src.update_time,
      src.datetime
    );
    if (!raw) continue;
    // epoch seconds / ms
    if (/^\d{10,13}$/.test(raw)) {
      const n = Number(raw);
      const d = new Date(raw.length >= 13 ? n : n * 1000);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

export function isCancelPayload(
  ...sources: Array<Record<string, unknown> | null | undefined>
): boolean {
  for (const src of sources) {
    if (!src) continue;
    if (
      src.canceled === true ||
      src.cancelled === true ||
      src.voided === true ||
      src.is_void === true ||
      src.refunded === true
    ) {
      return true;
    }
    const status = (
      pickString(
        src.event,
        src.type,
        src.action,
        src.status,
        src.state,
        src.order_state,
        src.payment_status,
        src.eventKind,
        src.event_kind,
        src.kind
      ) || ""
    ).toLowerCase();
    if (
      /cancel|cancelled|canceled|void|refund|annul|deleted|payment\.updated.*fail/.test(
        status
      )
    ) {
      return true;
    }
    // Square webhook type
    if (/order\.fulfillment\.updated|order\.updated/.test(status)) {
      const state = pickString(src.state, asRecord(src.order)?.state);
      if (state && /cancel|void/i.test(state)) return true;
    }
  }
  return false;
}

export function withEventMeta(
  sale: Omit<PosCanonicalSale, "eventKind"> & { eventKind?: PosEventKind },
  roots: Array<Record<string, unknown> | null | undefined>
): PosCanonicalSale {
  const cancel = sale.eventKind === "CANCEL" || isCancelPayload(...roots);
  return {
    ...sale,
    eventKind: cancel ? "CANCEL" : sale.eventKind ?? "SALE",
    soldAt: sale.soldAt ?? pickOccurredAt(...roots),
  };
}

export function extractOrderId(
  ...sources: Array<Record<string, unknown> | null | undefined>
): string | null {
  for (const src of sources) {
    if (!src) continue;
    const id = pickString(
      src.id,
      src.order_id,
      src.orderId,
      src.ticket_id,
      src.ticketId,
      src.saleID,
      src.sale_id,
      src.transaction_id,
      src.transactionId,
      src.number,
      src.numero,
      src.uid,
      src.event_id
    );
    if (id) return id;
  }
  return null;
}

export function makeExternalEventId(
  orderId: string | null,
  eventKind: PosEventKind | undefined
): string | null {
  if (!orderId) return null;
  return eventKind === "CANCEL" ? `cancel:${orderId}` : orderId;
}
