"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, requireTenantDb } from "@/lib/session";
import { encryptCredential, generateWebhookSecret } from "@/lib/credentials";

export async function createPosConnectionAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const vendor = String(formData.get("vendor") || "custom");
  const apiKey = String(formData.get("apiKey") || "").trim();
  const note = String(formData.get("vendorNote") || "").trim();
  const secret = generateWebhookSecret();

  if (!name) {
    redirect("/kiosks?error=name");
  }

  const displayName = note ? `${name} (${note.slice(0, 40)})` : name;

  await requireTenantDb(async (db, ctx) => {
    await db.externalPosConnection.create({
      data: {
        restaurantId: ctx.tenantId,
        name: displayName,
        vendor,
        webhookSecret: secret,
        apiKeyEncrypted: apiKey ? encryptCredential(apiKey) : null,
        merchantExternalId:
          String(formData.get("merchantExternalId") || "").trim() || null,
        apiBaseUrl: String(formData.get("apiBaseUrl") || "").trim() || null,
        status: "PENDING",
      },
    });
  });

  revalidatePath("/kiosks");
  redirect(
    `/kiosks?connected=1&name=${encodeURIComponent(displayName)}&pos=${encodeURIComponent(vendor)}`
  );
}

export async function regeneratePosSecretAction(formData: FormData) {
  const id = String(formData.get("connectionId") || "").trim();
  if (!id) redirect("/kiosks?error=missing");

  const vendor = await requireTenantDb(async (db, ctx) => {
    const existing = await db.externalPosConnection.findFirst({
      where: { id, restaurantId: ctx.tenantId },
    });
    if (!existing) return null;

    await db.externalPosConnection.updateMany({
      where: { id, restaurantId: ctx.tenantId },
      data: {
        webhookSecret: generateWebhookSecret(),
        status: existing.lastOrderAt ? existing.status : "PENDING",
      },
    });
    return existing.vendor;
  });

  if (!vendor) redirect("/kiosks?error=missing");
  revalidatePath("/kiosks");
  redirect(`/kiosks?secret=1&pos=${encodeURIComponent(vendor)}`);
}

export async function updatePosApiKeyAction(formData: FormData) {
  const id = String(formData.get("connectionId") || "").trim();
  const apiKey = String(formData.get("apiKey") || "").trim();
  const merchantExternalId = String(
    formData.get("merchantExternalId") || ""
  ).trim();
  const apiBaseUrl = String(formData.get("apiBaseUrl") || "").trim();
  if (!id) redirect("/kiosks?error=missing");

  const vendor = await requireTenantDb(async (db, ctx) => {
    const existing = await db.externalPosConnection.findFirst({
      where: { id, restaurantId: ctx.tenantId },
    });
    if (!existing) return null;

    await db.externalPosConnection.updateMany({
      where: { id, restaurantId: ctx.tenantId },
      data: {
        ...(apiKey
          ? { apiKeyEncrypted: encryptCredential(apiKey) }
          : formData.has("clearApiKey")
            ? { apiKeyEncrypted: null }
            : {}),
        merchantExternalId: merchantExternalId || null,
        apiBaseUrl: apiBaseUrl || null,
      },
    });
    return existing.vendor;
  });

  if (!vendor) redirect("/kiosks?error=missing");
  revalidatePath("/kiosks");
  redirect(`/kiosks?apikey=1&pos=${encodeURIComponent(vendor)}`);
}

export async function deletePosConnectionAction(formData: FormData) {
  const id = String(formData.get("connectionId") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim();
  if (!id) redirect("/kiosks?error=missing");

  const outcome = await requireTenantDb(async (db, ctx) => {
    const existing = await db.externalPosConnection.findFirst({
      where: { id, restaurantId: ctx.tenantId },
    });
    if (!existing) return "missing" as const;
    if (confirm !== existing.name) {
      return { error: "delete" as const, vendor: existing.vendor };
    }
    await db.externalPosConnection.deleteMany({
      where: { id, restaurantId: ctx.tenantId },
    });
    return "ok" as const;
  });

  if (outcome === "missing") redirect("/kiosks?error=missing");
  if (outcome !== "ok") {
    redirect(
      `/kiosks?error=delete&pos=${encodeURIComponent(outcome.vendor)}`
    );
  }

  revalidatePath("/kiosks");
  redirect("/kiosks?deleted=1");
}

/** Simule une vente pour vérifier le pipeline caisse → stock / produits. */
export async function simulatePosTestSaleAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("connectionId") || "").trim();
  if (!id) redirect("/kiosks?error=missing");

  const connection = await requireTenantDb(async (db, ctx) => {
    return db.externalPosConnection.findFirst({
      where: { id, restaurantId: ctx.tenantId },
    });
  });
  if (!connection) redirect("/kiosks?error=missing");

  const { ingestPosWebhook } = await import("@/lib/pos/ingest");
  await ingestPosWebhook({
    restaurantId: session.user.restaurantId,
    connectionId: connection.id,
    vendor: connection.vendor,
    body: {
      secret: connection.webhookSecret,
      order_id: `test-${Date.now()}`,
      items: [
        {
          name: "Test Margin — article démo",
          sku: "MARGIN-TEST",
          quantity: 1,
          unit_price: 1.5,
        },
      ],
    },
  });

  revalidatePath("/kiosks");
  revalidatePath("/ingredients");
  redirect(`/kiosks?tested=1&pos=${encodeURIComponent(connection.vendor)}`);
}
