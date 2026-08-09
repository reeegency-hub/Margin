import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { asRecord, pickString } from "@/lib/pos/helpers";
import { authenticatePosWebhook } from "@/lib/pos/webhook-auth";
import {
  posWebhookHttpResponse,
  runPosWebhookIngest,
} from "@/lib/pos/webhook-response";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await ctx.params;

  const connection = await prisma.externalPosConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const rawBody = await req.text();
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const root = asRecord(body) ?? {};
  const headerSecret = req.headers.get("x-webhook-secret");
  const signatureHeader =
    req.headers.get("x-pos-signature") ||
    req.headers.get("x-hub-signature-256") ||
    req.headers.get("x-margin-signature");

  const auth = authenticatePosWebhook({
    webhookSecret: connection.webhookSecret,
    rawBody,
    plainSecret: pickString(root.secret) || headerSecret,
    signatureHeader,
  });

  if (!auth.ok) {
    console.warn("[pos-webhook] auth failed", {
      connectionId,
      vendor: connection.vendor,
      status: auth.status,
    });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await runPosWebhookIngest(
    {
      id: connection.id,
      restaurantId: connection.restaurantId,
      vendor: connection.vendor,
      webhookSecret: connection.webhookSecret,
    },
    body,
    { matchMode: "sku_then_name" }
  );

  return posWebhookHttpResponse(result);
}

/** Health minimal — pas de name/vendor (réduction surface IDOR). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await ctx.params;
  const connection = await prisma.externalPosConnection.findUnique({
    where: { id: connectionId },
    select: { id: true, status: true },
  });
  if (!connection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    id: connection.id,
    status: connection.status,
  });
}
