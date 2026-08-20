import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createDeliveryOrder,
  ingestDeliveryOrderAsSale,
} from "@/lib/delivery-engine";
import {
  verifyHmacSha256,
  verifyPlainWebhookSecret,
} from "@/lib/pos/webhook-auth";

type DeliveryPayload = {
  secret?: string;
  externalOrderId?: string;
  customerName?: string;
  totalAmount?: number;
  /** Decrement stock via recipe match (sku / dishName) */
  items?: {
    sku?: string;
    dishName?: string;
    name?: string;
    quantity?: number;
  }[];
  applyStock?: boolean;
};

const PLATFORMS = new Set(["uber_eats", "deliveroo", "just_eat", "other"]);

/**
 * Webhook générique plateformes livraison (pilote 1 semaine).
 * Ce n’est PAS l’API partenaire Uber/Deliveroo — branchez Zapier/Make
 * ou un script qui POSTe le JSON ici.
 *
 * POST /api/webhooks/delivery/{uber_eats|deliveroo|just_eat|other}
 * Header: x-webhook-secret (plain) et/ou x-margin-signature (HMAC-SHA256 du body)
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ platform: string }> }
) {
  const { platform: raw } = await ctx.params;
  const platform = raw.trim().toLowerCase();
  if (!PLATFORMS.has(platform)) {
    return NextResponse.json(
      { error: "Platform must be uber_eats|deliveroo|just_eat|other" },
      { status: 400 }
    );
  }

  const rawBody = await req.text();
  let payload: DeliveryPayload;
  try {
    payload = JSON.parse(rawBody) as DeliveryPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const headerSecret = req.headers.get("x-webhook-secret");
  const plainSecret = payload.secret || headerSecret || "";
  const signature =
    req.headers.get("x-margin-signature") ||
    req.headers.get("x-hub-signature-256") ||
    "";

  if (!plainSecret && !signature) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 401 });
  }

  // Ne pas chercher par secret en SQL (timing). Charge les connexions
  // de la plateforme puis compare en timing-safe / HMAC.
  const connections = await prisma.deliveryPlatformConnection.findMany({
    where: { platform },
    select: {
      id: true,
      restaurantId: true,
      webhookSecret: true,
    },
  });

  const connection = connections.find((c) => {
    if (!c.webhookSecret) return false;
    if (
      signature &&
      verifyHmacSha256({
        rawBody,
        secret: c.webhookSecret,
        signatureHeader: signature,
      })
    ) {
      return true;
    }
    if (plainSecret && verifyPlainWebhookSecret(plainSecret, c.webhookSecret)) {
      return true;
    }
    return false;
  });

  if (!connection) {
    return NextResponse.json(
      { error: "Unknown secret / platform — save credentials in Connexions first" },
      { status: 401 }
    );
  }

  // Ne jamais réinjecter secret dans les logs / réponses
  delete payload.secret;

  const externalOrderId =
    payload.externalOrderId?.trim() || `DEL-${platform}-${Date.now()}`;
  const totalAmount = Number(payload.totalAmount) || 0;

  const order = await createDeliveryOrder(connection.restaurantId, {
    platform,
    externalOrderId,
    customerName: payload.customerName,
    totalAmount,
  });

  let stock: { recorded: number; unmatched: string[] } | null = null;
  if (payload.applyStock !== false && payload.items?.length) {
    stock = await ingestDeliveryOrderAsSale(
      connection.restaurantId,
      platform,
      externalOrderId,
      payload.items
    );
  }

  await prisma.deliveryPlatformConnection.updateMany({
    where: { id: connection.id, restaurantId: connection.restaurantId },
    data: { lastSyncAt: new Date(), status: "WEBHOOK_LIVE" },
  });

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    externalOrderId,
    stock,
    note: "Webhook générique Margin Shop — pas l’API officielle Uber/Deliveroo.",
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ platform: string }> }
) {
  const { platform } = await ctx.params;
  return NextResponse.json({
    ok: true,
    platform,
    usage:
      "POST JSON { externalOrderId, totalAmount, customerName, items:[{dishName|sku, quantity}], applyStock?: true } with header x-webhook-secret and/or x-margin-signature (HMAC-SHA256)",
  });
}
