"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, requireTenantDb } from "@/lib/session";
import { recordSale, recordReceipt, sendAlertWhatsApp } from "@/lib/stock-engine";
import { StockAlertService } from "@/lib/stock-alert-service";
import { getNotifier, getNotifierChannel } from "@/lib/notifications";
import {
  proposePurchaseOrders,
  validatePurchaseOrder,
  cancelPurchaseOrder,
  createManualPurchaseOrder,
  kitchenCheckPurchaseOrder,
  validateAllOpenOrders,
} from "@/lib/orders-engine";
import {
  createDraftInventory,
  updateInventoryLines,
  validateInventory,
} from "@/lib/inventory-engine";
import {
  clockInEmployee,
  markAbsent,
  ensureTodayShifts,
  createShiftForEmployee,
  deleteShiftForRestaurant,
  renameEmployee,
  updateEmployeeHourlyRate,
  defaultHourlyRate,
} from "@/lib/employee-engine";
import { startOfDay } from "date-fns";
import {
  simulateKioskSale,
  simulateDeliverySale,
  setDeliveryStatus,
  setKioskStatus,
} from "@/lib/channels";
import {
  analyzeMenuText,
  type ProposedDish,
} from "@/lib/menu-ai";
import { analyzeMenuFromFile } from "@/lib/menu-file-extract";
import { suggestReorderQty as smartReorderQty } from "@/lib/units";
import { parseVoiceIntent } from "@/lib/voice-intent";
import {
  createDriver,
  toggleDriver,
  deleteDriver,
  upsertPlatformConnection,
  testPlatformConnection,
  simulateIncomingDelivery,
} from "@/lib/delivery-engine";
import { encryptCredential, generateWebhookSecret } from "@/lib/credentials";
import { getOpenAIConfig } from "@/lib/openai";
import { validateProposedCatalog } from "@/lib/catalog/validate";
import { normalizeCatalogName } from "@/lib/catalog/normalize";
import {
  syncCatalogIssues,
  mergeIngredients,
  applySuggestedUnit,
  applySuggestedThreshold,
  ignoreCatalogIssue,
} from "@/lib/catalog/issues";
import {
  defaultThresholdForIngredient,
  seedDefaultThresholds,
  refreshVelocityThresholds,
} from "@/lib/catalog/thresholds";
import * as catalogActions from "./actions/catalog";
import * as posActions from "./actions/pos";

/** Façade async (Next interdit les re-exports dans un fichier "use server"). */
export async function createIngredient(formData: FormData) {
  return catalogActions.createIngredient(formData);
}
export async function createIngredientsBulkAction(
  ...args: Parameters<typeof catalogActions.createIngredientsBulkAction>
) {
  return catalogActions.createIngredientsBulkAction(...args);
}
export async function updateIngredient(formData: FormData) {
  return catalogActions.updateIngredient(formData);
}
export async function deleteIngredient(formData: FormData) {
  return catalogActions.deleteIngredient(formData);
}
export async function createDish(formData: FormData) {
  return catalogActions.createDish(formData);
}
export async function deleteDish(formData: FormData) {
  return catalogActions.deleteDish(formData);
}

export async function createSale(formData: FormData) {
  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantity").map(Number);
  const lines = productIds
    .map((productId, i) => ({
      productId,
      quantity: Math.max(0, Math.floor(quantities[i] || 0)),
    }))
    .filter((l) => l.productId && l.quantity > 0);

  const res = await createManualSaleAction(lines);
  if (!res.ok) {
    redirect(`/sales?error=${encodeURIComponent(res.error)}`);
  }
  redirect("/sales?sold=1");
}

/** Ventes hors caisse (comptoir, rond, oubli POS). Décrémente le stock. */
export async function createManualSaleAction(
  lines: { productId: string; quantity: number }[]
): Promise<
  | { ok: true; itemCount: number; totalAmount: number }
  | { ok: false; error: string }
> {
  const cleaned = lines
    .map((l) => ({
      productId: String(l.productId || "").trim(),
      quantity: Math.max(0, Math.floor(Number(l.quantity) || 0)),
    }))
    .filter((l) => l.productId && l.quantity > 0);

  if (!cleaned.length) {
    return { ok: false, error: "Ajoutez au moins un produit et une quantité." };
  }

  try {
    const sale = await requireTenantDb(async (db, ctx) => {
      return recordSale(ctx.tenantId, cleaned, { db, channel: "manual" });
    });
    revalidatePath("/");
    revalidatePath("/ingredients");
    revalidatePath("/sales");
    revalidatePath("/kiosks");
    revalidatePath("/orders");
    return {
      ok: true,
      itemCount: cleaned.reduce((n, l) => n + l.quantity, 0),
      totalAmount: sale.totalAmount,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Enregistrement impossible.",
    };
  }
}

/** Dictaphone hors caisse — audio → texte → produits du catalogue. */
export async function transcribeManualSaleAction(input: {
  audioBase64: string;
  mimeType: string;
}): Promise<
  | {
      ok: true;
      text: string;
      matched: { productId: string; quantity: number; name: string }[];
      unknown: string[];
    }
  | { ok: false; error: string }
> {
  const session = await requireSession();
  const tenantId = session.user.restaurantId;

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const limit = checkRateLimit(`sale-stt:${tenantId}`, 30, 60 * 60 * 1000);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Trop de dictées. Réessayez dans ${limit.retryAfterSec}s.`,
    };
  }

  const mime = String(input.mimeType || "audio/webm").slice(0, 80);
  const raw = String(input.audioBase64 || "").replace(/^data:[^;]+;base64,/, "");
  if (!raw) {
    return { ok: false, error: "Enregistrement vide. Réessayez." };
  }

  const { SALE_AUDIO_MAX_BYTES, transcribeAudio } = await import(
    "@/lib/voice-stt"
  );
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    return { ok: false, error: "Audio illisible." };
  }
  if (!buf.length || buf.length > SALE_AUDIO_MAX_BYTES) {
    return {
      ok: false,
      error: "Enregistrement trop long. 20 secondes max, dites juste les produits.",
    };
  }

  const { text, engine } = await transcribeAudio(buf, mime, tenantId);
  if (engine === "none") {
    return {
      ok: false,
      error: "Dictée indisponible. Notez la vente à la main ci-dessous.",
    };
  }
  if (!text) {
    return {
      ok: false,
      error: "Rien entendu. Rapprochez-vous et dites « deux lait, un pain ».",
    };
  }

  const products = await prisma.product.findMany({
    where: { restaurantId: tenantId, active: true },
    select: { id: true, name: true, externalSku: true },
    take: 400,
  });
  const { parseSpokenSale, matchSpokenToCatalog } = await import(
    "@/lib/voice-intent"
  );
  const spoken = parseSpokenSale(text);
  const { matched, unknown } = matchSpokenToCatalog(
    spoken,
    products.map((p) => ({ id: p.id, name: p.name, sku: p.externalSku }))
  );

  return {
    ok: true,
    text,
    matched: matched.map((m) => ({
      productId: m.product.id,
      quantity: m.quantity,
      name: m.product.name,
    })),
    unknown,
  };
}

export async function createReceipt(formData: FormData) {
  const supplierId = String(formData.get("supplierId"));
  const note = String(formData.get("note") || "");
  const stockUnitIds = formData.getAll("stockUnitId").map(String);
  const quantities = formData.getAll("quantity").map(Number);
  const unitPrices = formData.getAll("unitPrice").map((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  });

  const lines = stockUnitIds
    .map((stockUnitId, i) => ({
      stockUnitId,
      quantity: quantities[i] || 0,
      unitPrice: unitPrices[i] ?? null,
    }))
    .filter((l) => l.stockUnitId && l.quantity > 0);

  await requireTenantDb(async (db, ctx) => {
    await recordReceipt(ctx.tenantId, supplierId, lines, note, db);
  });
  revalidatePath("/");
  revalidatePath("/ingredients");
  revalidatePath("/costs");
  redirect("/costs?received=1");
}

export async function uploadInvoiceFileAction(formData: FormData): Promise<
  | { ok: true; receipt: import("@/lib/invoice-import").ProposedReceipt }
  | { ok: false; error: string }
> {
  const session = await requireSession();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "Fichier manquant." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "Fichier trop volumineux (max 10 Mo)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { sniffUpload } = await import("@/lib/security/upload-sniff");
  const sniffed = sniffUpload(buffer, file.type, file.name, "invoice");
  if (!sniffed.ok) return sniffed;

  const [catalog, openai] = await Promise.all([
    prisma.stockUnit.findMany({
      where: { restaurantId: session.user.restaurantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    getOpenAIConfig(session.user.restaurantId),
  ]);

  const { analyzeInvoiceFromFile } = await import("@/lib/invoice-import");
  return analyzeInvoiceFromFile(
    buffer,
    sniffed.mime,
    file.name,
    catalog,
    { apiKey: openai.apiKey, model: openai.model }
  );
}

export async function confirmInvoiceImportAction(payload: {
  supplierId: string;
  note?: string | null;
  lines: { stockUnitId: string; quantity: number; unitPrice: number | null }[];
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await requireSession();
  const supplierId = String(payload.supplierId || "");
  const lines = (payload.lines || []).filter(
    (l) => l.stockUnitId && l.quantity > 0
  );
  if (!supplierId) return { ok: false, error: "Fournisseur requis." };
  if (!lines.length) {
    return { ok: false, error: "Aucune ligne rattachée au stock." };
  }

  try {
    await requireTenantDb(async (db, ctx) => {
      await recordReceipt(
        ctx.tenantId,
        supplierId,
        lines.map((l) => ({
          stockUnitId: l.stockUnitId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        payload.note || undefined,
        db
      );
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Import impossible.",
    };
  }

  revalidatePath("/");
  revalidatePath("/ingredients");
  revalidatePath("/costs");
  return { ok: true, count: lines.length };
}

export async function updateSettings(formData: FormData) {
  const session = await requireSession();
  const raw = String(formData.get("whatsappTo") || "").trim();
  const whatsappTo = raw
    ? raw.replace(/^whatsapp:/i, "").replace(/\s/g, "")
    : null;

  if (whatsappTo) {
    const taken = await prisma.restaurant.findFirst({
      where: {
        whatsappTo,
        NOT: { id: session.user.restaurantId },
      },
      select: { id: true },
    });
    if (taken) {
      redirect("/settings?error=whatsapp_taken");
    }
  }

  try {
    await prisma.restaurant.update({
      where: { id: session.user.restaurantId },
      data: { whatsappTo },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unique constraint|P2002/i.test(msg)) {
      redirect("/settings?error=whatsapp_taken");
    }
    throw e;
  }
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function updateOpenAISettings(formData: FormData) {
  const session = await requireSession();
  const apiKey = String(formData.get("openaiApiKey") || "").trim();
  const model = String(formData.get("openaiModel") || "").trim() || "gpt-4o-mini";
  const clear = formData.get("clearOpenAI") === "1";

  const data: {
    openaiApiKeyEncrypted?: string | null;
    openaiModel?: string | null;
  } = {
    openaiModel: model,
  };

  if (clear) {
    data.openaiApiKeyEncrypted = null;
  } else if (apiKey && !apiKey.includes("*")) {
    data.openaiApiKeyEncrypted = encryptCredential(apiKey);
  }

  await prisma.restaurant.update({
    where: { id: session.user.restaurantId },
    data,
  });

  revalidatePath("/settings");
  revalidatePath("/ingredients/menu");
  redirect("/settings?saved=1");
}

export async function testOpenAIConnection(): Promise<
  | { ok: true; model: string; message: string }
  | { ok: false; error: string }
> {
  const session = await requireSession();
  const config = await getOpenAIConfig(session.user.restaurantId);
  if (!config.configured) {
    return {
      ok: false,
      error: "Aucune clé OpenAI configurée. Ajoutez-la ci-dessous.",
    };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Clé invalide ou refusée (${res.status}).`,
      };
    }
    return {
      ok: true,
      model: config.model,
      message: `Connexion OK · modèle ${config.model}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Connexion OpenAI impossible.",
    };
  }
}

export async function testWhatsApp() {
  const session = await requireSession();
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: session.user.restaurantId },
  });
  if (!restaurant.whatsappTo) {
    redirect("/settings?error=nonumber");
  }
  const channel = getNotifierChannel();
  if (channel !== "twilio") {
    redirect("/settings?error=whatsapp_not_live");
  }
  const notifier = getNotifier();
  const testBody = `Margin — Bot actif pour ${restaurant.name}.\nRépondez avec un numéro ou tapez « inventaire ».`;
  if (notifier.sendInteractive) {
    await notifier.sendInteractive({
      to: restaurant.whatsappTo,
      body: testBody,
      restaurantId: restaurant.id,
      purpose: "test",
      templateKey: "test",
      templateVars: { "1": testBody },
      options: [
        { id: "1", label: "Liste de courses (stock)" },
        { id: "2", label: "Marquer liste faite" },
        { id: "3", label: "Lancer inventaire" },
      ],
    });
  } else {
    await notifier.send({
      to: restaurant.whatsappTo,
      body: `Margin — Bot actif pour ${restaurant.name}.\n1️⃣ Commander · 2️⃣ Valider · 3️⃣ Inventaire`,
      restaurantId: restaurant.id,
      purpose: "test",
      templateKey: "test",
      templateVars: { "1": testBody },
    });
  }
  redirect("/settings?tested=1");
}

export async function dismissStockRecapAction() {
  const session = await requireSession();
  await StockAlertService.dismiss(session.user.restaurantId);
  revalidatePath("/");
}

export async function sendStockRecapWhatsAppAction(): Promise<{
  ok: boolean;
  message: string;
  waMeLink: string | null;
  simulated?: boolean;
  needSettings?: boolean;
}> {
  const session = await requireSession();
  const res = await StockAlertService.sendWhatsApp(session.user.restaurantId);
  revalidatePath("/");
  if (!res.ok && res.message.includes("numéro")) {
    return { ...res, needSettings: true };
  }
  return res;
}

export async function resolveAlert(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id"));
  await prisma.alert.updateMany({
    where: { id, restaurantId: session.user.restaurantId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  revalidatePath("/");
  redirect("/");
}

/** Refuser / ignorer une alerte depuis le popup Accueil (sans redirect). */
export async function dismissAlertAction(alertId: string) {
  const session = await requireSession();
  await prisma.alert.updateMany({
    where: {
      id: alertId,
      restaurantId: session.user.restaurantId,
      status: "ACTIVE",
    },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  revalidatePath("/");
  return { ok: true as const };
}

/** « Envoyer sur » WhatsApp = alerte traitée (popup Accueil). */
export async function treatAlertSentAction(alertId: string) {
  const session = await requireSession();
  await prisma.alert.updateMany({
    where: {
      id: alertId,
      restaurantId: session.user.restaurantId,
      status: "ACTIVE",
    },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      whatsappSentAt: new Date(),
    },
  });
  revalidatePath("/");
  return { ok: true as const };
}

export async function resendAlertWhatsApp(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id"));
  const restaurantId = session.user.restaurantId;
  const alert = await prisma.alert.findFirst({
    where: { id, restaurantId },
  });
  if (alert) {
    await prisma.alert.updateMany({
      where: { id, restaurantId },
      data: { whatsappSentAt: null },
    });
    await sendAlertWhatsApp(restaurantId, id);
  }
  revalidatePath("/");
  redirect("/");
}

export async function generateOrders() {
  await requireTenantDb(async (db, ctx) => {
    await proposePurchaseOrders(ctx.tenantId, db);
  });
  revalidatePath("/orders");
  revalidatePath("/");
  redirect("/orders?generated=1");
}

export async function createStockOrderAction(formData: FormData): Promise<
  | { ok: true; orderId: string }
  | { ok: false; error: string }
> {
  try {
    const order = await requireTenantDb(async (db, ctx) =>
      createManualPurchaseOrder(
        ctx.tenantId,
        {
          stockUnitId: String(formData.get("stockUnitId") || ""),
          quantity: Number(formData.get("quantity") || 0),
        },
        db
      )
    );
    revalidatePath("/orders");
    revalidatePath("/ingredients");
    revalidatePath("/");
    return { ok: true, orderId: order.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ajout impossible",
    };
  }
}

export async function validateOrderAction(formData: FormData) {
  await requireTenantDb(async (db, ctx) => {
    await validatePurchaseOrder(ctx.tenantId, String(formData.get("id")), db);
  });
  revalidatePath("/orders");
  revalidatePath("/cuisine");
  revalidatePath("/");
  redirect("/orders?validated=1");
}

/** Une seule liste : marque tout comme fait + réintègre le stock. */
export async function completeShoppingListAction() {
  await requireTenantDb(async (db, ctx) => {
    await validateAllOpenOrders(ctx.tenantId, db);
  });
  revalidatePath("/orders");
  revalidatePath("/ingredients");
  revalidatePath("/");
  redirect("/orders?validated=1");
}

export async function kitchenCheckOrderAction(formData: FormData) {
  await requireTenantDb(async (db, ctx) => {
    await kitchenCheckPurchaseOrder(
      ctx.tenantId,
      String(formData.get("id")),
      String(formData.get("checkedBy") || "Rayon"),
      db
    );
  });
  revalidatePath("/orders");
  revalidatePath("/cuisine");
  revalidatePath("/");
  const from = String(formData.get("from") || "");
  redirect(from === "cuisine" ? "/cuisine?kitchen=1" : "/orders?kitchen=1");
}

export async function cancelOrderAction(formData: FormData) {
  await requireTenantDb(async (db, ctx) => {
    await cancelPurchaseOrder(ctx.tenantId, String(formData.get("id")), db);
  });
  revalidatePath("/orders");
  revalidatePath("/cuisine");
  revalidatePath("/");
  redirect("/orders");
}

export async function startInventory() {
  const inv = await requireTenantDb(async (db, ctx) =>
    createDraftInventory(ctx.tenantId, undefined, { db })
  );
  revalidatePath("/inventory");
  redirect(`/inventory/${inv.id}`);
}

/** Vérification filtrée sur une liste de références stock (ex. produits découverts caisse) */
export async function startInventoryForIngredientsAction(formData: FormData) {
  const raw = String(formData.get("stockUnitIds") || "");
  const stockUnitIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const note = String(formData.get("note") || "Vérification produits caisse").trim();
  const inv = await requireTenantDb(async (db, ctx) =>
    createDraftInventory(ctx.tenantId, note || undefined, {
      ...(stockUnitIds.length ? { stockUnitIds } : {}),
      db,
    })
  );
  revalidatePath("/inventory");
  redirect(`/inventory/${inv.id}`);
}

export async function saveInventoryDraft(formData: FormData) {
  const inventoryId = String(formData.get("inventoryId"));
  const lineIds = formData.getAll("lineId").map(String);
  const counted = formData.getAll("countedQty").map(Number);
  await requireTenantDb(async (db, ctx) => {
    await updateInventoryLines(
      ctx.tenantId,
      inventoryId,
      lineIds.map((lineId, i) => ({ lineId, countedQty: counted[i] ?? 0 })),
      db
    );
  });
  revalidatePath(`/inventory/${inventoryId}`);
  redirect(`/inventory/${inventoryId}?saved=1`);
}

export async function validateInventoryAction(formData: FormData) {
  const inventoryId = String(formData.get("inventoryId"));
  const lineIds = formData.getAll("lineId").map(String);
  const counted = formData.getAll("countedQty").map(Number);
  await requireTenantDb(async (db, ctx) => {
    if (lineIds.length) {
      await updateInventoryLines(
        ctx.tenantId,
        inventoryId,
        lineIds.map((lineId, i) => ({ lineId, countedQty: counted[i] ?? 0 })),
        db
      );
    }
    await validateInventory(ctx.tenantId, inventoryId, db);
  });
  revalidatePath("/inventory");
  revalidatePath("/ingredients");
  revalidatePath("/orders");
  revalidatePath("/cuisine");
  revalidatePath("/");
  redirect("/inventory?validated=1");
}

export async function clockInAction(formData: FormData) {
  await requireTenantDb(async (db, ctx) => {
    await clockInEmployee(
      ctx.tenantId,
      String(formData.get("employeeId")),
      String(formData.get("shiftId")),
      undefined,
      db
    );
  });
  revalidatePath("/employees");
  revalidatePath("/");
  redirect("/employees");
}

export async function renameEmployeeAction(formData: FormData) {
  await requireTenantDb(async (db, ctx) => {
    await renameEmployee(
      ctx.tenantId,
      String(formData.get("employeeId")),
      String(formData.get("name") || ""),
      db
    );
  });
  revalidatePath("/employees");
  revalidatePath("/employees/planning");
  redirect("/employees?renamed=1");
}

export async function planTodayShiftsAction() {
  await requireTenantDb(async (db, ctx) => {
    await ensureTodayShifts(ctx.tenantId, db);
  });
  revalidatePath("/employees");
  revalidatePath("/employees/planning");
  redirect("/employees?planned=1");
}

export async function createShiftAction(formData: FormData) {
  const employeeId = String(formData.get("employeeId"));
  const dateRaw = String(formData.get("date") || "");
  const startTime = String(formData.get("startTime") || "18:00");
  const endTime = String(formData.get("endTime") || "23:00");
  const role = String(formData.get("role") || "").trim();
  const rateRaw = String(formData.get("hourlyRate") || "").trim();
  const date = dateRaw ? startOfDay(new Date(dateRaw)) : startOfDay(new Date());
  await requireTenantDb(async (db, ctx) => {
    const rid = ctx.tenantId;
    if (rateRaw) {
      const hourlyRate = Number(rateRaw.replace(",", "."));
      if (Number.isFinite(hourlyRate)) {
        await updateEmployeeHourlyRate(rid, employeeId, hourlyRate, db);
      }
    }
    await createShiftForEmployee(
      rid,
      {
        employeeId,
        date,
        startTime,
        endTime,
        role: role || undefined,
      },
      db
    );
  });
  revalidatePath("/employees");
  revalidatePath("/employees/planning");
  redirect("/employees/planning?created=1");
}

export async function deleteShiftAction(formData: FormData) {
  await requireTenantDb(async (db, ctx) => {
    await deleteShiftForRestaurant(
      ctx.tenantId,
      String(formData.get("shiftId")),
      db
    );
  });
  revalidatePath("/employees");
  revalidatePath("/employees/planning");
  redirect("/employees/planning?deleted=1");
}

export async function markAbsentAction(formData: FormData) {
  await requireTenantDb(async (db, ctx) => {
    await markAbsent(
      ctx.tenantId,
      String(formData.get("employeeId")),
      String(formData.get("shiftId")),
      db
    );
  });
  revalidatePath("/employees");
  revalidatePath("/");
  redirect("/employees");
}

export async function simulateKioskAction(formData: FormData) {
  const session = await requireSession();
  await simulateKioskSale(
    session.user.restaurantId,
    String(formData.get("kioskId"))
  );
  revalidatePath("/kiosks");
  revalidatePath("/");
  revalidatePath("/ingredients");
  redirect("/kiosks?sold=1");
}

export async function setKioskStatusAction(formData: FormData) {
  const session = await requireSession();
  await setKioskStatus(
    session.user.restaurantId,
    String(formData.get("kioskId")),
    String(formData.get("status"))
  );
  revalidatePath("/kiosks");
  revalidatePath("/");
  redirect("/kiosks");
}

export async function setDeliveryStatusAction(formData: FormData) {
  const session = await requireSession();
  await setDeliveryStatus(
    session.user.restaurantId,
    String(formData.get("platform")),
    String(formData.get("status"))
  );
  revalidatePath("/delivery");
  revalidatePath("/");
  redirect("/delivery");
}

export async function simulateDeliveryAction(formData: FormData) {
  const session = await requireSession();
  await simulateDeliverySale(
    session.user.restaurantId,
    String(formData.get("platform"))
  );
  revalidatePath("/delivery");
  revalidatePath("/");
  redirect("/delivery?sold=1");
}

function normalizeName(s: string) {
  return normalizeCatalogName(s);
}

/** Quantité de réappro suggérée après import menu. */
function suggestReorderQty(unit: string, recipeQty: number, name?: string): number {
  const u = (unit === "ml" || unit === "pcs" ? unit : "g") as "g" | "ml" | "pcs";
  const base = smartReorderQty(u, name);
  const q = Math.max(0, Number(recipeQty) || 0);
  if (u === "pcs") return Math.max(base, Math.ceil(q * 40));
  return Math.max(base, Math.ceil(q * 50));
}

export async function analyzeMenuAction(menuText: string): Promise<
  | {
      ok: true;
      dishes: ProposedDish[];
      engine: "openai" | "local";
      openaiError?: string;
      validation: ReturnType<typeof validateProposedCatalog>;
    }
  | { ok: false; error: string }
> {
  const session = await requireSession();
  const text = String(menuText || "").trim();
  if (text.length < 3) {
    return { ok: false, error: "Collez au moins quelques lignes de menu." };
  }

  const [existing, openai] = await Promise.all([
    prisma.stockUnit.findMany({
      where: { restaurantId: session.user.restaurantId },
      select: { name: true },
    }),
    getOpenAIConfig(session.user.restaurantId),
  ]);

  const result = await analyzeMenuText(
    text,
    existing.map((i) => i.name),
    { apiKey: openai.apiKey, model: openai.model }
  );

  if (!result.dishes.length) {
    return {
      ok: false,
      error: "Aucun produit détecté. Vérifiez le format (nom + prix éventuel).",
    };
  }

  const validation = validateProposedCatalog(
    result.dishes,
    existing.map((i) => i.name)
  );

  return {
    ok: true,
    dishes: result.dishes,
    engine: result.engine,
    openaiError: result.openaiError,
    validation,
  };
}

export async function confirmMenuRecipesAction(
  dishes: ProposedDish[]
): Promise<
  | {
      ok: true;
      createdDishes: number;
      createdIngredients: number;
      openIssues: number;
    }
  | { ok: false; error: string }
> {
  if (!dishes?.length) {
    return { ok: false, error: "Aucune proposition à valider." };
  }

  try {
    return await requireTenantDb(async (db, ctx) => {
      const restaurantId = ctx.tenantId;
      let createdDishes = 0;
      let createdIngredients = 0;

      const existing = await db.stockUnit.findMany({
        where: { restaurantId },
      });
      const byNorm = new Map(existing.map((i) => [normalizeName(i.name), i]));

      // Pré-compte les nouveaux produits pour le plafond plan
      const newNames = new Set<string>();
      for (const dish of dishes) {
        for (const ing of dish.ingredients || []) {
          const ingName = ing.name?.trim();
          if (!ingName || !(ing.quantity > 0)) continue;
          const key = normalizeName(ingName);
          if (!byNorm.has(key)) newNames.add(key);
        }
      }
      const { assertCanAddProducts } = await import("@/lib/plan-limits");
      const gate = await assertCanAddProducts(
        restaurantId,
        newNames.size,
        db
      );
      if (!gate.ok) {
        return { ok: false as const, error: gate.error };
      }

      for (const dish of dishes) {
        const name = dish.name?.trim();
        if (!name || !dish.ingredients?.length) continue;

        const lines: {
          stockUnitId: string;
          quantity: number;
          unit: string;
        }[] = [];

        for (const ing of dish.ingredients) {
          const ingName = ing.name?.trim();
          if (!ingName || !(ing.quantity > 0)) continue;

          const key = normalizeName(ingName);
          let ingredient = byNorm.get(key);
          if (!ingredient) {
            const defaults = defaultThresholdForIngredient(
              ingName,
              ing.unit || "g"
            );
            const unit = ["g", "ml", "pcs"].includes(ing.unit || "")
              ? (ing.unit as "g" | "ml" | "pcs")
              : defaults.category === "liquide"
                ? "ml"
                : defaults.category === "piece"
                  ? "pcs"
                  : "g";
            ingredient = await db.stockUnit.create({
              data: {
                restaurantId,
                name: ingName,
                unit,
                stockTheoretical: 0,
                criticalThreshold: defaults.criticalThreshold,
                reorderQty: Math.max(
                  defaults.reorderQty,
                  suggestReorderQty(unit, ing.quantity, ingName)
                ),
                category: defaults.category,
                thresholdSource: defaults.thresholdSource,
              },
            });
            byNorm.set(key, ingredient);
            createdIngredients += 1;
          }

          lines.push({
            stockUnitId: ingredient.id,
            quantity: ing.quantity,
            unit: ing.unit || ingredient.unit,
          });
        }

        if (!lines.length) continue;

        const merged = new Map<
          string,
          { stockUnitId: string; quantity: number; unit: string }
        >();
        for (const line of lines) {
          const prev = merged.get(line.stockUnitId);
          if (prev) {
            prev.quantity += line.quantity;
          } else {
            merged.set(line.stockUnitId, { ...line });
          }
        }

        await db.product.create({
          data: {
            restaurantId,
            name,
            salePrice: Number(dish.salePrice) || 0,
            productStocks: { create: [...merged.values()] },
          },
        });
        createdDishes += 1;
      }

      if (!createdDishes) {
        return {
          ok: false as const,
          error: "Rien n’a pu être créé — vérifiez les lignes.",
        };
      }

      await syncCatalogIssues(restaurantId);
      const openIssues = await db.catalogIssue.count({
        where: { restaurantId, status: "OPEN" },
      });

      revalidatePath("/dishes");
      revalidatePath("/ingredients");
      revalidatePath("/ingredients/menu");
      revalidatePath("/sales/new");

      return {
        ok: true as const,
        createdDishes,
        createdIngredients,
        openIssues,
      };
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Import catalogue impossible.",
    };
  }
}

export async function validateMenuDraftAction(
  dishes: ProposedDish[]
): Promise<ReturnType<typeof validateProposedCatalog>> {
  const session = await requireSession();
  const existing = await prisma.stockUnit.findMany({
    where: { restaurantId: session.user.restaurantId },
    select: { name: true },
  });
  return validateProposedCatalog(
    dishes,
    existing.map((i) => i.name)
  );
}

export async function mergeCatalogIngredientsAction(
  keepId: string,
  removeId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  const res = await mergeIngredients(
    session.user.restaurantId,
    keepId,
    removeId
  );
  if (res.ok) {
    await syncCatalogIssues(session.user.restaurantId);
    revalidatePath("/ingredients");
  }
  return res;
}

export async function fixCatalogUnitAction(
  stockUnitId: string
): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const res = await applySuggestedUnit(
    session.user.restaurantId,
    stockUnitId
  );
  await syncCatalogIssues(session.user.restaurantId);
  revalidatePath("/ingredients");
  return res;
}

export async function fixCatalogThresholdAction(
  stockUnitId: string
): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const res = await applySuggestedThreshold(
    session.user.restaurantId,
    stockUnitId
  );
  await syncCatalogIssues(session.user.restaurantId);
  revalidatePath("/ingredients");
  return res;
}

export async function ignoreCatalogIssueAction(
  issueId: string
): Promise<void> {
  const session = await requireSession();
  await ignoreCatalogIssue(session.user.restaurantId, issueId);
  revalidatePath("/ingredients");
}

export async function syncCatalogIssuesAction(): Promise<{ open: number }> {
  const session = await requireSession();
  const r = await syncCatalogIssues(session.user.restaurantId);
  revalidatePath("/ingredients");
  return r;
}

export async function seedCatalogThresholdsAction(): Promise<{ updated: number }> {
  const session = await requireSession();
  const updated = await seedDefaultThresholds(session.user.restaurantId);
  await syncCatalogIssues(session.user.restaurantId);
  revalidatePath("/ingredients");
  return { updated };
}

export async function uploadMenuFileAction(formData: FormData): Promise<
  | {
      ok: true;
      dishes: ProposedDish[];
      engine: "openai" | "local";
      source: string;
      extractedText: string;
      openaiError?: string;
      validation: ReturnType<typeof validateProposedCatalog>;
    }
  | { ok: false; error: string }
> {
  const session = await requireSession();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "Fichier manquant." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "Fichier trop volumineux (max 10 Mo)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { sniffUpload } = await import("@/lib/security/upload-sniff");
  const sniffed = sniffUpload(buffer, file.type, file.name, "menu");
  if (!sniffed.ok) return sniffed;

  const [existing, openai] = await Promise.all([
    prisma.stockUnit.findMany({
      where: { restaurantId: session.user.restaurantId },
      select: { name: true },
    }),
    getOpenAIConfig(session.user.restaurantId),
  ]);

  const result = await analyzeMenuFromFile(
    buffer,
    sniffed.mime,
    file.name,
    existing.map((i) => i.name),
    { apiKey: openai.apiKey, model: openai.model }
  );

  if (!result.ok) return result;

  const validation = validateProposedCatalog(
    result.dishes,
    existing.map((i) => i.name)
  );

  revalidatePath("/");
  revalidatePath("/dishes");
  return {
    ok: true,
    dishes: result.dishes,
    engine: result.engine,
    source: result.source,
    extractedText: result.extractedText,
    openaiError: result.openaiError,
    validation,
  };
}

export async function applyVoiceInventoryAction(
  inventoryId: string,
  text: string
): Promise<
  | { ok: true; message: string; updated: Record<string, number> }
  | { ok: false; error: string }
> {
  const session = await requireSession();
  const intent = parseVoiceIntent(text);
  if (intent.type !== "inventory" || !intent.items.length) {
    return { ok: false, error: "Format : « Tomates 5 kg, Salade 2 kg »" };
  }

  const inv = await prisma.inventoryCount.findFirst({
    where: {
      id: inventoryId,
      restaurantId: session.user.restaurantId,
      status: "DRAFT",
    },
    include: { lines: { include: { stockUnit: true } } },
  });
  if (!inv) return { ok: false, error: "Inventaire introuvable." };

  const updated: Record<string, number> = {};
  const batch: { lineId: string; countedQty: number }[] = [];

  for (const item of intent.items) {
    const line = inv.lines.find((l) =>
      l.stockUnit.name.toLowerCase().includes(item.name.toLowerCase())
    );
    if (!line) continue;
    let qty = item.quantity;
    if (item.unit === "kg" && line.stockUnit.unit === "g") qty *= 1000;
    if (item.unit === "l" && line.stockUnit.unit === "ml") qty *= 1000;
    batch.push({ lineId: line.id, countedQty: qty });
    updated[line.id] = qty;
  }

  if (!batch.length) {
    return { ok: false, error: "Aucune référence stock reconnue." };
  }

  await updateInventoryLines(session.user.restaurantId, inventoryId, batch);
  revalidatePath(`/inventory/${inventoryId}`);

  return {
    ok: true,
    message: `${batch.length} ligne(s) mise(s) à jour.`,
    updated,
  };
}

export async function applyVoiceRecipeAction(text: string): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  await requireSession();
  const intent = parseVoiceIntent(text);
  if (intent.type !== "recipe") {
    return {
      ok: false,
      error: "Format : « Nom du produit : 150 g référence, 1 pain »",
    };
  }

  const dishes: ProposedDish[] = [
    {
      name: intent.dishName,
      salePrice: 0,
      ingredients: intent.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit === "kg" ? "g" : i.unit === "l" ? "ml" : i.unit,
        confidence: 0.85,
      })),
      confidence: 0.85,
      source: "heuristic",
    },
  ];

  const res = await confirmMenuRecipesAction(dishes);
  if (!res.ok) return res;
  revalidatePath("/dishes");
  return {
    ok: true,
    message: `Fiche « ${intent.dishName} » créée (${res.createdIngredients} références stock).`,
  };
}

export async function saveDeliveryCredentialsAction(formData: FormData) {
  const session = await requireSession();
  const platform = String(formData.get("platform"));
  const apiKey = String(formData.get("apiKey") || "").trim();
  const storeId = String(formData.get("storeId") || "").trim();
  const returnTo = String(formData.get("returnTo") || "/delivery").trim();
  const safeReturn =
    returnTo === "/settings" || returnTo.startsWith("/settings")
      ? "/settings"
      : "/delivery";

  await upsertPlatformConnection(session.user.restaurantId, platform, {
    ...(apiKey ? { apiKey } : {}),
    storeId: storeId || undefined,
    webhookSecret: generateWebhookSecret(),
    status: apiKey ? "KEY_STORED" : "PENDING",
  });

  revalidatePath("/delivery");
  revalidatePath("/settings");
  redirect(`${safeReturn}?saved=1`);
}

export async function testDeliveryConnectionAction(formData: FormData) {
  const session = await requireSession();
  const platform = String(formData.get("platform"));
  const returnTo = String(formData.get("returnTo") || "/delivery").trim();
  const safeReturn =
    returnTo === "/settings" || returnTo.startsWith("/settings")
      ? "/settings"
      : "/delivery";
  const result = await testPlatformConnection(
    session.user.restaurantId,
    platform
  );
  revalidatePath("/delivery");
  revalidatePath("/settings");
  redirect(
    `${safeReturn}?connected=1&msg=${encodeURIComponent(result.message || "OK")}`
  );
}

export async function createDriverAction(formData: FormData) {
  const session = await requireSession();
  await createDriver(session.user.restaurantId, {
    name: String(formData.get("name")),
    phone: String(formData.get("phone") || ""),
  });
  revalidatePath("/delivery");
  redirect("/delivery?driver=1");
}

export async function toggleDriverAction(formData: FormData) {
  const session = await requireSession();
  await toggleDriver(
    session.user.restaurantId,
    String(formData.get("driverId")),
    formData.get("isActive") === "1"
  );
  revalidatePath("/delivery");
  redirect("/delivery");
}

export async function deleteDriverAction(formData: FormData) {
  const session = await requireSession();
  await deleteDriver(
    session.user.restaurantId,
    String(formData.get("driverId"))
  );
  revalidatePath("/delivery");
  redirect("/delivery");
}

export async function simulateDeliveryOrderAction(formData: FormData) {
  const session = await requireSession();
  await simulateIncomingDelivery(
    session.user.restaurantId,
    String(formData.get("platform"))
  );
  revalidatePath("/delivery");
  redirect("/delivery?order=1");
}

export async function createPosConnectionAction(formData: FormData) {
  return posActions.createPosConnectionAction(formData);
}
export async function regeneratePosSecretAction(formData: FormData) {
  return posActions.regeneratePosSecretAction(formData);
}
export async function updatePosApiKeyAction(formData: FormData) {
  return posActions.updatePosApiKeyAction(formData);
}
export async function deletePosConnectionAction(formData: FormData) {
  return posActions.deletePosConnectionAction(formData);
}
export async function simulatePosTestSaleAction(formData: FormData) {
  return posActions.simulatePosTestSaleAction(formData);
}

export async function importPosSalesAction(formData: FormData): Promise<
  | { ok: true; lines: number; pending: number; recorded: number }
  | { ok: false; error: string }
> {
  const session = await requireSession();
  const restaurantId = session.user.restaurantId;
  const vendor = String(formData.get("vendor") || "csv");
  const connectionId = String(formData.get("connectionId") || "").trim() || null;
  const recordSales = String(formData.get("recordSales") || "") === "1";
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choisissez un fichier CSV exporté depuis la caisse." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Fichier trop volumineux (max 8 Mo)." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { assertTextImport, parseCsvText } = await import("@/lib/pos/csv");
    const text = assertTextImport(file.name, buffer);
    const rows = parseCsvText(text);
    if (!rows.length) {
      return {
        ok: false,
        error: "Aucune ligne détectée — vérifiez les en-têtes (nom, sku, qté…).",
      };
    }

    const { getPosAdapter } = await import("@/lib/pos/adapters");
    const { ingestPosImportLines } = await import("@/lib/pos/ingest");
    const adapter = getPosAdapter(vendor);
    const lines = adapter.parseImportRows(rows);
    if (!lines.length) {
      return {
        ok: false,
        error:
          "Aucune ligne produit reconnue. Attendu : colonnes nom/produit (+ sku, quantité, prix).",
      };
    }

    const result = await ingestPosImportLines({
      restaurantId,
      connectionId,
      vendor,
      lines,
      recordSales,
    });

    if (connectionId) {
      await prisma.externalPosConnection.updateMany({
        where: { id: connectionId, restaurantId },
        data: { lastOrderAt: new Date(), status: "CONNECTED" },
      });
    }

    revalidatePath("/kiosks");
    revalidatePath("/dishes");
    revalidatePath("/ingredients");
    return {
      ok: true,
      lines: lines.length,
      pending: result.pending,
      recorded: result.recorded,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Import impossible.",
    };
  }
}

export async function acceptPosPendingProductsAction(formData: FormData) {
  const session = await requireSession();
  const ids = formData.getAll("pendingId").map(String).filter(Boolean);
  if (!ids.length) {
    redirect("/kiosks?pending=0");
  }
  const { acceptPosPendingProducts } = await import("@/lib/pos/catalog");
  const result = await acceptPosPendingProducts(
    session.user.restaurantId,
    ids
  );
  revalidatePath("/kiosks");
  revalidatePath("/dishes");
  revalidatePath("/ingredients");
  revalidatePath("/inventory");
  const stockUnitIds = result.stockUnitIds.join(",");
  redirect(
    `/kiosks?accepted=${result.accepted}&countIngredients=${encodeURIComponent(stockUnitIds)}`
  );
}

export async function ignorePosPendingProductsAction(formData: FormData) {
  const session = await requireSession();
  const ids = formData.getAll("pendingId").map(String).filter(Boolean);
  const { ignorePosPendingProducts } = await import("@/lib/pos/catalog");
  await ignorePosPendingProducts(session.user.restaurantId, ids);
  revalidatePath("/kiosks");
  redirect("/kiosks?ignored=1");
}

export type ProcurementMode = "suppliers_deliver" | "self_shop" | "mixed";

const ONBOARDING_PLATFORM_KEYS = [
  "uber_eats",
  "deliveroo",
  "just_eat",
  "other",
] as const;

function isStubEmployeeName(name: string) {
  return /^(Salle|Cuisine|Livreur) \d+$/.test(name);
}

export async function getPostLoginPath(): Promise<string> {
  const session = await requireSession();
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: session.user.restaurantId },
      select: { onboardingCompletedAt: true },
    });
    return restaurant?.onboardingCompletedAt ? "/" : "/onboarding";
  } catch {
    // Stale Prisma client after schema change — force onboarding path
    return "/onboarding";
  }
}

export async function saveOnboardingPlan(input: {
  plan: string;
  billingPeriod: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const plan = String(input.plan || "").trim();
  const billingPeriod = String(input.billingPeriod || "monthly").trim();
  if (!["boutique", "commerce", "reseau"].includes(plan)) {
    return { ok: false, error: "Choisissez un plan." };
  }
  if (!["monthly", "yearly"].includes(billingPeriod)) {
    return { ok: false, error: "Période invalide." };
  }
  await prisma.restaurant.update({
    where: { id: session.user.restaurantId },
    data: { plan, billingPeriod },
  });
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function adminCreateStoreAction(formData: FormData) {
  const { requireAdminSession } = await import("@/lib/admin");
  const session = await requireAdminSession();
  if (!session) {
    redirect("/login?error=admin");
  }

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const whatsapp = String(formData.get("whatsapp") || "").trim() || null;
  const plan = String(formData.get("plan") || "commerce").trim();
  const billingPeriod = String(formData.get("billingPeriod") || "monthly").trim();
  const skipOnboarding = String(formData.get("skipOnboarding") || "") === "1";

  if (!name || !email || !password) {
    redirect("/admin?error=missing");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/admin?error=email");
  }

  const { assertCanAddStore } = await import("@/lib/plan-limits");
  const storeGate = await assertCanAddStore(email, prisma);
  if (!storeGate.ok) {
    redirect(`/admin?error=${encodeURIComponent(storeGate.error)}`);
  }

  const bcrypt = await import("bcryptjs");
  const restaurant = await prisma.restaurant.create({
    data: {
      name,
      timezone: "Europe/Paris",
      whatsappTo: whatsapp,
      plan: ["boutique", "commerce", "reseau"].includes(plan) ? plan : "commerce",
      billingPeriod: ["monthly", "yearly"].includes(billingPeriod)
        ? billingPeriod
        : "monthly",
      stripeStatus: "none",
      active: true,
      onboardingCompletedAt: skipOnboarding ? new Date() : null,
      procurementMode: skipOnboarding ? "mixed" : null,
    },
  });

  await prisma.user.create({
    data: {
      email,
      name: name, // nom du commerce — pas de stub « Gérant »
      passwordHash: await bcrypt.hash(password, 10),
      restaurantId: restaurant.id,
    },
  });

  // Commerce vierge : pas de plateformes / équipe / catalogue pré-créés

  revalidatePath("/admin");
  const configure = String(formData.get("configureNow") || "") === "1";
  if (configure) {
    redirect(`/admin/stores/${restaurant.id}`);
  }
  redirect(`/admin?created=${encodeURIComponent(restaurant.name)}`);
}

export async function requestSignupOtpAction(input: {
  email: string;
  channel?: "email" | "sms";
  phone?: string;
  /** Honeypot */
  website?: string;
}): Promise<
  | {
      ok: true;
      challengeId: string;
      channel: "email" | "sms";
      expiresInSec: number;
      devCode?: string;
    }
  | { ok: false; error: string }
> {
  if (String(input.website || "").trim()) {
    return { ok: false, error: "Inscription refusée." };
  }

  const email = String(input.email || "").trim().toLowerCase();
  const channel = input.channel === "sms" ? "sms" : "email";

  const {
    checkRateLimit,
    clientIpFromHeaders,
    OTP_SEND_EMAIL_LIMIT,
    OTP_SEND_IP_LIMIT,
    OTP_SEND_WINDOW_MS,
  } = await import("@/lib/rate-limit");
  const ip = await clientIpFromHeaders();
  const ipLimit = checkRateLimit(
    `otp:ip:${ip}`,
    OTP_SEND_IP_LIMIT,
    OTP_SEND_WINDOW_MS
  );
  if (!ipLimit.ok) {
    return {
      ok: false,
      error: `Trop de codes demandés. Réessayez dans ${ipLimit.retryAfterSec}s.`,
    };
  }
  const emailLimit = checkRateLimit(
    `otp:email:${email}`,
    OTP_SEND_EMAIL_LIMIT,
    OTP_SEND_WINDOW_MS
  );
  if (!emailLimit.ok) {
    return {
      ok: false,
      error: `Trop de codes pour cet email. Réessayez dans ${emailLimit.retryAfterSec}s.`,
    };
  }

  const { createAndSendSignupOtp } = await import("@/lib/signup-otp");
  return createAndSendSignupOtp({
    email,
    channel,
    phone: input.phone,
  });
}

export async function signupAndCheckoutAction(input: {
  name: string;
  email: string;
  password: string;
  plan: string;
  billingPeriod: string;
  /** Honeypot anti-bot — doit rester vide */
  website?: string;
  /** Code affiliation magasin (?ref=) */
  referralCode?: string;
  /** Code ambassadeur (?amb=) */
  ambassadorCode?: string;
  /** Opt-in newsletter conseils Margin */
  newsletterOptIn?: boolean;
  /** Code OTP reçu par email/SMS */
  otpCode?: string;
  /** Challenge renvoyé par requestSignupOtpAction */
  otpChallengeId?: string;
}): Promise<
  | { ok: true; checkoutUrl?: string; redirectTo?: string }
  | { ok: false; error: string }
> {
  // Bot trap
  if (String(input.website || "").trim()) {
    return { ok: false, error: "Inscription refusée." };
  }

  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "").trim();
  const plan = ["commerce", "reseau", "boutique"].includes(input.plan)
    ? input.plan
    : "commerce";
  const billingPeriod = ["monthly", "yearly"].includes(input.billingPeriod)
    ? input.billingPeriod
    : "monthly";
  const { normalizeReferralCode, codeFromRestaurantId } = await import(
    "@/lib/affiliate"
  );
  const referralCode = normalizeReferralCode(String(input.referralCode || ""));
  const { normalizeAmbassadorCode } = await import("@/lib/ambassador-referral");
  const ambassadorCode = normalizeAmbassadorCode(
    String(input.ambassadorCode || "")
  );

  if (!name || !email || password.length < 8) {
    return {
      ok: false,
      error: "Nom, email et mot de passe (8+ caractères) requis.",
    };
  }

  const { consumeSignupOtp, mustVerifySignupOtp, isSignupOtpLive } =
    await import("@/lib/signup-otp");
  if (mustVerifySignupOtp()) {
    if (process.env.NODE_ENV === "production" && !isSignupOtpLive()) {
      return {
        ok: false,
        error:
          "Inscription temporairement indisponible (vérification OTP non configurée).",
      };
    }
    const otp = await consumeSignupOtp({
      email,
      code: String(input.otpCode || ""),
      challengeId: input.otpChallengeId,
    });
    if (!otp.ok) {
      return otp;
    }
  }

  const {
    checkRateLimit,
    clientIpFromHeaders,
    SIGNUP_EMAIL_LIMIT,
    SIGNUP_IP_LIMIT,
    SIGNUP_WINDOW_MS,
  } = await import("@/lib/rate-limit");
  const ip = await clientIpFromHeaders();
  const ipLimit = checkRateLimit(
    `signup:ip:${ip}`,
    SIGNUP_IP_LIMIT,
    SIGNUP_WINDOW_MS
  );
  if (!ipLimit.ok) {
    return {
      ok: false,
      error: `Trop de tentatives. Réessayez dans ${ipLimit.retryAfterSec}s.`,
    };
  }
  const emailLimit = checkRateLimit(
    `signup:email:${email}`,
    SIGNUP_EMAIL_LIMIT,
    SIGNUP_WINDOW_MS
  );
  if (!emailLimit.ok) {
    return {
      ok: false,
      error: `Trop de tentatives pour cet email. Réessayez dans ${emailLimit.retryAfterSec}s.`,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Cet email est déjà utilisé. Connectez-vous plutôt." };
  }

  let referredByRestaurantId: string | undefined;
  if (referralCode) {
    const referrer = await prisma.restaurant.findFirst({
      where: { referralCode },
      select: { id: true, active: true },
    });
    if (referrer?.active) {
      referredByRestaurantId = referrer.id;
    }
  }

  const bcrypt = await import("bcryptjs");
  const restaurant = await prisma.restaurant.create({
    data: {
      name,
      timezone: "Europe/Paris",
      plan,
      billingPeriod,
      stripeStatus: "incomplete",
      active: false,
      referredByRestaurantId: referredByRestaurantId ?? null,
    },
  });

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { referralCode: codeFromRestaurantId(restaurant.id) },
  });

  await prisma.user.create({
    data: {
      email,
      name, // nom du commerce — commerce vierge, pas de stub « Gérant »
      passwordHash: await bcrypt.hash(password, 10),
      restaurantId: restaurant.id,
    },
  });

  if (ambassadorCode) {
    const ambassador = await prisma.ambassador.findFirst({
      where: { referralCode: ambassadorCode, active: true, status: "actif" },
      select: { id: true },
    });
    if (ambassador) {
      const { createReferralForRestaurant } = await import("@/lib/crm/activity");
      await createReferralForRestaurant({
        ambassadorId: ambassador.id,
        restaurantId: restaurant.id,
        commissionPercent: 15,
        status: "signed_up",
      }).catch(() => null);
    }
  }

  if (input.newsletterOptIn !== false) {
    const { subscribeToNewsletter } = await import("@/lib/newsletter");
    await subscribeToNewsletter({
      email,
      name,
      source: "signup",
      restaurantId: restaurant.id,
      sendWelcome: true,
    });
  }

  // Commerce vierge : pas Uber/Deliveroo / équipe / produits pré-créés

  const { isStripeConfigured, getStripe, stripePriceId } = await import(
    "@/lib/stripe"
  );
  if (isStripeConfigured()) {
    const stripe = getStripe();
    const priceId = stripePriceId(
      plan as "commerce" | "reseau" | "boutique",
      billingPeriod as "monthly" | "yearly"
    );
    if (!stripe || !priceId) {
      return {
        ok: false,
        error:
          "Paiement indisponible (tarif manquant). Contactez le support pilote.",
      };
    }
    try {
      const base =
        process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
        process.env.WEBHOOK_BASE_URL?.replace(/\/$/, "") ||
        "http://localhost:3020";
      const { affiliateCheckoutDiscounts } = await import(
        "@/lib/stripe/affiliate-discount"
      );
      const discounts = await affiliateCheckoutDiscounts(
        stripe,
        Boolean(referredByRestaurantId)
      );
      const checkout = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        ...(discounts ? { discounts } : {}),
        success_url: `${base}/login?paid=1&email=${encodeURIComponent(email)}`,
        cancel_url: `${base}/signup?plan=${plan}&billing=${billingPeriod}${
          referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ""
        }`,
        metadata: {
          plan,
          billingPeriod,
          restaurantId: restaurant.id,
          affiliateDiscount: discounts ? "1" : "0",
          referredByRestaurantId: referredByRestaurantId || "",
        },
        subscription_data: {
          metadata: {
            plan,
            billingPeriod,
            restaurantId: restaurant.id,
            referredByRestaurantId: referredByRestaurantId || "",
          },
        },
      });
      if (checkout.url) {
        return { ok: true, checkoutUrl: checkout.url };
      }
      return {
        ok: false,
        error:
          "Impossible d’ouvrir le paiement Stripe. Réessayez ou contactez le support.",
      };
    } catch (e) {
      console.error("[signup] checkout failed", e);
      return {
        ok: false,
        error:
          "Paiement indisponible pour le moment. Réessayez ou contactez le support.",
      };
    }
  }

  // Sans Stripe (dev local uniquement) : activer pour l’onboarding
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { active: true, stripeStatus: "none" },
  });
  return { ok: true, redirectTo: "/onboarding" };
}

export async function subscribeNewsletterAction(input: {
  email: string;
  source?: "landing" | "signup";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = String(input.email || "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Email requis." };

  const {
    checkRateLimit,
    clientIpFromHeaders,
    SIGNUP_IP_LIMIT,
    SIGNUP_WINDOW_MS,
  } = await import("@/lib/rate-limit");
  const ip = await clientIpFromHeaders();
  const ipLimit = checkRateLimit(
    `newsletter:ip:${ip}`,
    SIGNUP_IP_LIMIT,
    SIGNUP_WINDOW_MS
  );
  if (!ipLimit.ok) {
    return {
      ok: false,
      error: `Trop de tentatives. Réessayez dans ${ipLimit.retryAfterSec}s.`,
    };
  }

  const { subscribeToNewsletter } = await import("@/lib/newsletter");
  const res = await subscribeToNewsletter({
    email,
    source: input.source === "signup" ? "signup" : "landing",
    sendWelcome: true,
  });
  if (!res.ok) return res;
  return { ok: true };
}

export async function saveOnboardingTeam(input: {
  salleNames: string[];
  cuisineNames: string[];
  livreurNames: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const rid = session.user.restaurantId;

  const clean = (names: string[]) =>
    names.map((n) => String(n || "").trim()).filter(Boolean);

  const salleNames = clean(input.salleNames || []);
  const cuisineNames = clean(input.cuisineNames || []);
  const livreurNames = clean(input.livreurNames || []);

  if (salleNames.length + cuisineNames.length + livreurNames.length < 1) {
    return {
      ok: false,
      error: "Ajoutez au moins un prénom (caisse, rayon ou livreur).",
    };
  }

  await prisma.restaurant.update({
    where: { id: rid },
    data: {
      staffSalle: salleNames.length,
      staffCuisine: cuisineNames.length,
      staffLivreur: livreurNames.length,
    },
  });

  // Replace previous onboarding stubs only (keep real employees already renamed)
  const existing = await prisma.employee.findMany({ where: { restaurantId: rid } });
  const stubIds = existing.filter((e) => isStubEmployeeName(e.name)).map((e) => e.id);
  if (stubIds.length) {
    await prisma.attendance.deleteMany({
      where: { employeeId: { in: stubIds } },
    });
    await prisma.shift.deleteMany({ where: { employeeId: { in: stubIds } } });
    await prisma.employee.deleteMany({
      where: { id: { in: stubIds }, restaurantId: rid },
    });
  }

  const people: { name: string; role: string; hourlyRate: number }[] = [
    ...salleNames.map((name) => ({
      name,
      role: "salle",
      hourlyRate: defaultHourlyRate("salle"),
    })),
    ...cuisineNames.map((name) => ({
      name,
      role: "cuisine",
      hourlyRate: defaultHourlyRate("cuisine"),
    })),
    ...livreurNames.map((name) => ({
      name,
      role: "livreur",
      hourlyRate: defaultHourlyRate("livreur"),
    })),
  ];

  // Avoid duplicate names against remaining employees
  const remainingNames = new Set(
    (await prisma.employee.findMany({ where: { restaurantId: rid } })).map(
      (e) => e.name.toLowerCase()
    )
  );
  const toCreate = people.filter((p) => !remainingNames.has(p.name.toLowerCase()));

  if (toCreate.length) {
    await prisma.employee.createMany({
      data: toCreate.map((s) => ({
        restaurantId: rid,
        name: s.name,
        role: s.role,
        hourlyRate: s.hourlyRate,
      })),
    });
  }

  await ensureTodayShifts(rid);

  const drivers = await prisma.deliveryDriver.findMany({
    where: { restaurantId: rid },
  });
  const stubDrivers = drivers.filter((d) => /^Livreur \d+$/.test(d.name));
  if (stubDrivers.length) {
    await prisma.deliveryDriver.deleteMany({
      where: {
        restaurantId: rid,
        id: { in: stubDrivers.map((d) => d.id) },
      },
    });
  }
  if (livreurNames.length) {
    const existingDrivers = await prisma.deliveryDriver.findMany({
      where: { restaurantId: rid },
    });
    const driverNames = new Set(
      existingDrivers.map((d) => d.name.toLowerCase())
    );
    const newDrivers = livreurNames.filter(
      (n) => !driverNames.has(n.toLowerCase())
    );
    if (newDrivers.length) {
      await prisma.deliveryDriver.createMany({
        data: newDrivers.map((name) => ({
          restaurantId: rid,
          name,
          isActive: true,
          whatsappOptIn: true,
        })),
      });
    }
  }

  revalidatePath("/employees");
  revalidatePath("/employees/planning");
  revalidatePath("/delivery");
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function saveOnboardingPlatforms(
  platforms: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const rid = session.user.restaurantId;
  const selected = [
    ...new Set(
      platforms
        .map((p) => String(p).trim())
        .filter((p) =>
          (ONBOARDING_PLATFORM_KEYS as readonly string[]).includes(p)
        )
    ),
  ];

  await prisma.restaurant.update({
    where: { id: rid },
    data: { onboardingPlatforms: JSON.stringify(selected) },
  });

  // Selected ≠ connected: wait for a real API key in Connexions
  for (const platform of selected) {
    const existing = await prisma.deliveryPlatformConnection.findUnique({
      where: {
        restaurantId_platform: { restaurantId: rid, platform },
      },
    });
    const alreadyLive =
      existing?.status === "CONNECTED" && Boolean(existing.apiKeyEncrypted);
    await prisma.deliveryPlatformConnection.upsert({
      where: {
        restaurantId_platform: { restaurantId: rid, platform },
      },
      create: {
        restaurantId: rid,
        platform,
        status: "PENDING",
      },
      update: alreadyLive
        ? {}
        : {
            status: "PENDING",
            connectedAt: null,
          },
    });
  }

  // Disconnect platforms not selected (from onboarding set)
  const toDisconnect = ONBOARDING_PLATFORM_KEYS.filter(
    (p) => !selected.includes(p)
  );
  if (toDisconnect.length) {
    await prisma.deliveryPlatformConnection.updateMany({
      where: {
        restaurantId: rid,
        platform: { in: [...toDisconnect] },
      },
      data: { status: "DISCONNECTED" },
    });
  }

  revalidatePath("/delivery");
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function saveOnboardingProcurement(
  _mode?: ProcurementMode
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  // Courses perso uniquement — pas de commande auto fournisseurs (hors scope)
  await prisma.restaurant.update({
    where: { id: session.user.restaurantId },
    data: { procurementMode: "self_shop" },
  });
  revalidatePath("/ingredients");
  revalidatePath("/orders");
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function saveOnboardingWhatsApp(
  whatsappTo: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const phone = String(whatsappTo || "")
    .trim()
    .replace(/^whatsapp:/i, "")
    .replace(/\s/g, "");
  if (phone) {
    const taken = await prisma.restaurant.findFirst({
      where: {
        whatsappTo: phone,
        NOT: { id: session.user.restaurantId },
      },
      select: { id: true },
    });
    if (taken) {
      return {
        ok: false,
        error: "Ce numéro est déjà utilisé par un autre compte.",
      };
    }
  }
  try {
    await prisma.restaurant.update({
      where: { id: session.user.restaurantId },
      data: { whatsappTo: phone || null },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unique constraint|P2002/i.test(msg)) {
      return {
        ok: false,
        error: "Ce numéro est déjà utilisé par un autre compte.",
      };
    }
    throw e;
  }
  revalidatePath("/settings");
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function testOnboardingWhatsApp(): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  const session = await requireSession();
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: session.user.restaurantId },
  });
  if (!restaurant.whatsappTo) {
    return { ok: false, error: "Ajoutez un numéro WhatsApp d’abord." };
  }
  const channel = getNotifierChannel();
  if (channel !== "twilio") {
    return {
      ok: false,
      error:
        "WhatsApp technique non actif (Twilio manquant). Le numéro est sauvé, mais aucun message n’a été envoyé. Contactez le support pilote.",
    };
  }
  const notifier = getNotifier();
  if (notifier.sendInteractive) {
    await notifier.sendInteractive({
      to: restaurant.whatsappTo,
      body: `Margin — Bot actif pour ${restaurant.name}.\nRépondez avec un numéro ou tapez « inventaire ».`,
      options: [
        { id: "1", label: "Liste de courses (stock)" },
        { id: "2", label: "Marquer liste faite" },
        { id: "3", label: "Lancer inventaire" },
      ],
    });
  } else {
    await notifier.send({
      to: restaurant.whatsappTo,
      body: `Margin — Connexion WhatsApp OK pour ${restaurant.name}.`,
    });
  }
  return { ok: true, message: "Message de test envoyé sur WhatsApp." };
}

export async function completeOnboarding(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await requireSession();
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: session.user.restaurantId },
  });

  // Commerce vierge : pas d’employé / stubs créés à l’ouverture.
  // Équipe et listes se remplissent seulement par actions du commerçant.
  const data: {
    onboardingCompletedAt: Date;
    procurementMode?: string;
    onboardingPlatforms?: string;
  } = {
    onboardingCompletedAt: new Date(),
  };

  if (!restaurant.procurementMode) {
    data.procurementMode = "self_shop";
  }
  if (!restaurant.onboardingPlatforms) {
    data.onboardingPlatforms = "[]";
  }

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data,
  });

  const { syncReferralStatusForRestaurant } = await import("@/lib/crm/activity");
  await syncReferralStatusForRestaurant(restaurant.id);

  revalidatePath("/");
  revalidatePath("/onboarding");
  return { ok: true };
}

async function requireAdminOrRedirect() {
  const { requireAdminSession } = await import("@/lib/admin");
  const session = await requireAdminSession();
  if (!session) redirect("/login?error=admin");
  return session;
}

export async function adminUpdateStoreAction(formData: FormData) {
  await requireAdminOrRedirect();
  const id = String(formData.get("restaurantId") || "");
  const name = String(formData.get("name") || "").trim();
  const timezone = String(formData.get("timezone") || "Europe/Paris").trim();
  const whatsappTo = String(formData.get("whatsappTo") || "").trim() || null;
  const plan = String(formData.get("plan") || "").trim();
  const billingPeriod = String(formData.get("billingPeriod") || "").trim();
  const active = String(formData.get("active") || "") === "1";
  const completeOnboardingFlag =
    String(formData.get("completeOnboarding") || "") === "1";
  const reopenOnboarding =
    String(formData.get("reopenOnboarding") || "") === "1";

  if (!id || !name) {
    redirect(`/admin/stores/${id || ""}?error=missing`);
  }

  const data: {
    name: string;
    timezone: string;
    whatsappTo: string | null;
    plan?: string;
    billingPeriod?: string;
    active: boolean;
    onboardingCompletedAt?: Date | null;
    procurementMode?: string;
  } = {
    name,
    timezone: timezone || "Europe/Paris",
    whatsappTo,
    active,
  };
  if (["boutique", "commerce", "reseau"].includes(plan)) data.plan = plan;
  if (["monthly", "yearly"].includes(billingPeriod)) {
    data.billingPeriod = billingPeriod;
  }
  if (completeOnboardingFlag) {
    data.onboardingCompletedAt = new Date();
    data.procurementMode = "mixed";
  } else if (reopenOnboarding) {
    data.onboardingCompletedAt = null;
  }

  await prisma.restaurant.update({
    where: { id },
    data,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/stores/${id}`);
  redirect(`/admin/stores/${id}?saved=1`);
}

export async function adminResetPasswordAction(formData: FormData) {
  await requireAdminOrRedirect();
  const restaurantId = String(formData.get("restaurantId") || "");
  const password = String(formData.get("password") || "").trim();
  if (!restaurantId || password.length < 8) {
    redirect(`/admin/stores/${restaurantId}?error=password`);
  }
  const user = await prisma.user.findFirst({
    where: { restaurantId },
    orderBy: { createdAt: "asc" },
  });
  if (!user) {
    redirect(`/admin/stores/${restaurantId}?error=nouser`);
  }
  const bcrypt = await import("bcryptjs");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      sessionVersion: { increment: 1 },
    },
  });
  revalidatePath(`/admin/stores/${restaurantId}`);
  redirect(`/admin/stores/${restaurantId}?password=1`);
}

export async function adminEnsurePosAction(formData: FormData) {
  await requireAdminOrRedirect();
  const restaurantId = String(formData.get("restaurantId") || "");
  const vendor = String(formData.get("vendor") || "generic").trim() || "generic";
  if (!restaurantId) redirect("/admin");

  const existing = await prisma.externalPosConnection.findFirst({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
  });
  const secret = generateWebhookSecret();
  if (existing) {
    await prisma.externalPosConnection.update({
      where: { id: existing.id },
      data: { vendor, webhookSecret: secret, status: "PENDING", name: existing.name || "Caisse" },
    });
  } else {
    await prisma.externalPosConnection.create({
      data: {
        restaurantId,
        name: "Caisse principale",
        vendor,
        webhookSecret: secret,
        status: "PENDING",
      },
    });
  }
  revalidatePath(`/admin/stores/${restaurantId}`);
  redirect(`/admin/stores/${restaurantId}?pos=1`);
}

export async function adminSeedTeamAction(formData: FormData) {
  await requireAdminOrRedirect();
  const restaurantId = String(formData.get("restaurantId") || "");
  if (!restaurantId) redirect("/admin");

  const count = await prisma.employee.count({ where: { restaurantId } });
  if (count === 0) {
    await prisma.employee.createMany({
      data: [
        {
          restaurantId,
          name: "Caisse 1",
          role: "salle",
          hourlyRate: 12,
        },
        {
          restaurantId,
          name: "Rayon 1",
          role: "cuisine",
          hourlyRate: 13,
        },
      ],
    });
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { staffSalle: 1, staffCuisine: 1, staffLivreur: 0 },
    });
  }
  revalidatePath(`/admin/stores/${restaurantId}`);
  redirect(`/admin/stores/${restaurantId}?team=1`);
}

export async function adminDeleteStoreAction(formData: FormData) {
  await requireAdminOrRedirect();
  const restaurantId = String(formData.get("restaurantId") || "");
  const confirm = String(formData.get("confirm") || "").trim();
  if (!restaurantId) redirect("/admin");
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant || confirm !== restaurant.name) {
    redirect(`/admin/stores/${restaurantId}?error=delete`);
  }
  await prisma.restaurant.delete({ where: { id: restaurantId } });
  revalidatePath("/admin");
  redirect("/admin?deleted=1");
}
