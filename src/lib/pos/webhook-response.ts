import { NextResponse } from "next/server";
import type { IngestPosResult } from "@/lib/pos/ingest";
import { ingestPosWebhook } from "@/lib/pos/ingest";

export type PosConnectionAuth = {
  id: string;
  restaurantId: string;
  vendor: string;
  webhookSecret: string;
};

/**
 * Réponse HTTP unifiée après ingest (ACK rapide au POS).
 */
export function posWebhookHttpResponse(result: IngestPosResult): NextResponse {
  if (result.duplicate) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      recorded: result.recorded,
      pending: result.pending,
      externalOrderId: result.externalOrderId,
      eventId: result.eventId,
      status: result.status,
    });
  }

  if (result.deferred) {
    return NextResponse.json({
      ok: true,
      deferred: true,
      externalOrderId: result.externalOrderId,
      eventId: result.eventId,
      status: result.status,
    });
  }

  if (result.error?.startsWith("SCHEMA:")) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        eventId: result.eventId,
        status: result.status,
      },
      { status: 422 }
    );
  }

  if (result.status === "SKU_NOT_FOUND") {
    return NextResponse.json({
      ok: true,
      recorded: result.recorded,
      pending: result.pending,
      unmatchedNames: result.unmatchedNames,
      unmatchedSkus: result.unmatchedSkus,
      externalOrderId: result.externalOrderId,
      eventId: result.eventId,
      status: "SKU_NOT_FOUND",
    });
  }

  if (result.status === "APPLIED" || result.status === "IGNORED_DUP") {
    return NextResponse.json({
      ok: true,
      recorded: result.recorded,
      pending: result.pending,
      unmatchedNames: result.unmatchedNames,
      unmatchedSkus: result.unmatchedSkus,
      externalOrderId: result.externalOrderId,
      eventId: result.eventId,
      saleId: result.saleId,
      status: result.status,
      duplicate: result.duplicate || undefined,
    });
  }

  if (result.recorded === 0 && result.pending === 0) {
    return NextResponse.json(
      {
        error: result.error || "No items",
        recorded: 0,
        pending: 0,
        eventId: result.eventId,
        status: result.status,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    recorded: result.recorded,
    pending: result.pending,
    unmatchedNames: result.unmatchedNames,
    unmatchedSkus: result.unmatchedSkus,
    externalOrderId: result.externalOrderId,
    eventId: result.eventId,
    saleId: result.saleId,
    status: result.status,
  });
}

export async function runPosWebhookIngest(
  connection: PosConnectionAuth,
  body: unknown,
  opts?: { matchMode?: "sku_strict" | "sku_then_name" }
): Promise<IngestPosResult> {
  return ingestPosWebhook({
    restaurantId: connection.restaurantId,
    connectionId: connection.id,
    vendor: connection.vendor,
    body,
    matchMode: opts?.matchMode ?? "sku_strict",
  });
}
