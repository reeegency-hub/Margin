import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ingestPosWebhook } from "@/lib/pos/ingest";
import { asRecord, pickString } from "@/lib/pos/helpers";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const root = asRecord(body) ?? {};
  const headerSecret = req.headers.get("x-webhook-secret");
  const secret = pickString(root.secret) || headerSecret;
  if (secret !== connection.webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await ingestPosWebhook({
    restaurantId: connection.restaurantId,
    connectionId: connection.id,
    vendor: connection.vendor,
    body,
  });

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
    externalOrderId: result.externalOrderId,
    eventId: result.eventId,
    status: result.status,
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await ctx.params;
  const connection = await prisma.externalPosConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      name: true,
      status: true,
      lastOrderAt: true,
      vendor: true,
    },
  });
  if (!connection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(connection);
}
