import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { asRecord, pickString } from "@/lib/pos/helpers";
import {
  authenticatePosWebhook,
  resolvePosProvider,
} from "@/lib/pos/webhook-auth";
import {
  posWebhookHttpResponse,
  runPosWebhookIngest,
} from "@/lib/pos/webhook-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/webhooks/pos/:provider
 *
 * Sync caisse temps réel — mapping SKU strict.
 *
 * Auth :
 * - HMAC : header `x-pos-signature` | `x-hub-signature-256` | `x-margin-signature`
 *   (sha256=<hex> du body brut avec le webhookSecret)
 * - ou secret : `x-webhook-secret` / body.secret
 *
 * Connexion :
 * - query `?connectionId=` **ou** header `x-margin-connection-id`
 * - le `provider` doit correspondre au vendor de la connexion (sumup → tiller)
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await ctx.params;
  const provider = resolvePosProvider(rawProvider);

  const connectionId =
    req.nextUrl.searchParams.get("connectionId") ||
    req.headers.get("x-margin-connection-id") ||
    "";

  if (!connectionId) {
    return NextResponse.json(
      {
        error:
          "connectionId requis (?connectionId= ou header x-margin-connection-id)",
      },
      { status: 400 }
    );
  }

  const connection = await prisma.externalPosConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  if (resolvePosProvider(connection.vendor) !== provider) {
    return NextResponse.json(
      {
        error: `Provider mismatch: URL=${provider}, connexion=${connection.vendor}`,
      },
      { status: 400 }
    );
  }

  const rawBody = await req.text();
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const root = asRecord(body) ?? {};
  const plainSecret =
    pickString(root.secret) || req.headers.get("x-webhook-secret");
  const signatureHeader =
    req.headers.get("x-pos-signature") ||
    req.headers.get("x-hub-signature-256") ||
    req.headers.get("x-margin-signature");

  const auth = authenticatePosWebhook({
    webhookSecret: connection.webhookSecret,
    rawBody,
    plainSecret,
    signatureHeader,
  });

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const result = await runPosWebhookIngest(
    {
      id: connection.id,
      restaurantId: connection.restaurantId,
      vendor: connection.vendor,
      webhookSecret: connection.webhookSecret,
    },
    body,
    { matchMode: "sku_strict" }
  );

  return posWebhookHttpResponse(result);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await ctx.params;
  const provider = resolvePosProvider(rawProvider);
  const connectionId =
    req.nextUrl.searchParams.get("connectionId") ||
    req.headers.get("x-margin-connection-id") ||
    "";

  if (!connectionId) {
    return NextResponse.json({
      ok: true,
      provider,
      usage:
        "POST /api/v1/webhooks/pos/{provider}?connectionId=… with x-webhook-secret or x-pos-signature (HMAC-SHA256)",
    });
  }

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
  if (!connection || resolvePosProvider(connection.vendor) !== provider) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(connection);
}
