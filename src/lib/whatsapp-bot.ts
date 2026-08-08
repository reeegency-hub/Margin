import { prisma } from "@/lib/db";
import { getNotifier, type InteractiveOption } from "@/lib/notifications";
import { proposePurchaseOrders, validatePurchaseOrder, cancelPurchaseOrder } from "@/lib/orders-engine";
import {
  createDraftInventory,
  updateInventoryLines,
  validateInventory,
} from "@/lib/inventory-engine";
import {
  assignDriver,
  updateDeliveryStatus,
  getActiveDrivers,
} from "@/lib/delivery-engine";
import { parseVoiceIntent, formatVoiceIntentSummary } from "@/lib/voice-intent";
import { transcribeAudio } from "@/lib/voice-stt";
import { formatQty } from "@/lib/stock-engine";
import {
  parsePointageMessage,
  clockInByName,
  clockOutByName,
} from "@/lib/employee-engine";

const SESSION_TTL_MS = 30 * 60 * 1000;

function normalizePhone(phone: string): string {
  return phone.replace(/^whatsapp:/i, "").replace(/\s/g, "");
}

function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a).replace(/\D/g, "");
  const nb = normalizePhone(b).replace(/\D/g, "");
  return na.endsWith(nb.slice(-9)) || nb.endsWith(na.slice(-9));
}

async function logAction(
  restaurantId: string,
  phone: string,
  action: string,
  payload: Record<string, unknown> = {}
) {
  await prisma.whatsAppActionLog.create({
    data: {
      restaurantId,
      phone: normalizePhone(phone),
      action,
      payload: JSON.stringify(payload),
    },
  });
}

async function getSession(restaurantId: string, phone: string) {
  const normalized = normalizePhone(phone);
  let session = await prisma.whatsAppSession.findUnique({
    where: { restaurantId_phone: { restaurantId, phone: normalized } },
  });

  if (session && session.expiresAt < new Date()) {
    await prisma.whatsAppSession.delete({ where: { id: session.id } });
    session = null;
  }

  return session;
}

async function upsertSession(
  restaurantId: string,
  phone: string,
  data: { flow: string; step?: number; payload?: Record<string, unknown> }
) {
  const normalized = normalizePhone(phone);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  return prisma.whatsAppSession.upsert({
    where: { restaurantId_phone: { restaurantId, phone: normalized } },
    create: {
      restaurantId,
      phone: normalized,
      flow: data.flow,
      step: data.step ?? 0,
      payload: JSON.stringify(data.payload ?? {}),
      expiresAt,
    },
    update: {
      flow: data.flow,
      step: data.step ?? 0,
      payload: JSON.stringify(data.payload ?? {}),
      expiresAt,
    },
  });
}

async function clearSession(restaurantId: string, phone: string) {
  const normalized = normalizePhone(phone);
  await prisma.whatsAppSession.deleteMany({
    where: { restaurantId, phone: normalized },
  });
}

async function findRestaurantByPhone(from: string) {
  const normalized = normalizePhone(from);
  // Lookup exact (numéros normalisés en settings) — contrainte @unique
  const exact = await prisma.restaurant.findUnique({
    where: { whatsappTo: normalized },
  });
  if (exact) return exact;

  // Fallback legacy : formats hétérogènes encore en base
  const restaurants = await prisma.restaurant.findMany({
    where: { whatsappTo: { not: null } },
    take: 200,
  });
  return restaurants.find(
    (r) => r.whatsappTo && phonesMatch(from, r.whatsappTo)
  );
}

export async function handleWhatsAppInbound(params: {
  from: string;
  body: string;
  mediaUrl?: string;
  mediaType?: string;
}): Promise<string> {
  const restaurant = await findRestaurantByPhone(params.from);
  if (!restaurant) {
    return "Numéro non autorisé. Configurez votre WhatsApp dans Paramètres.";
  }

  const rid = restaurant.id;
  const to = params.from;
  let text = (params.body || "").trim();

  if (!text && params.mediaUrl && params.mediaType?.startsWith("audio/")) {
    const audio = await downloadTwilioMedia(params.mediaUrl);
    if (audio) {
      const { text: transcribed, engine } = await transcribeAudio(
        audio,
        params.mediaType
      );
      if (engine === "none" || !transcribed) {
        return "Audio reçu mais transcription indisponible. Répondez en texte ou configurez OPENAI_API_KEY.";
      }
      text = transcribed;
    }
  }

  if (!text) {
    return menuHelp();
  }

  const session = await getSession(rid, to);
  const lower = text.toLowerCase().trim();

  // Global commands
  if (["menu", "aide", "help", "?"].includes(lower)) {
    await clearSession(rid, to);
    return menuHelp();
  }

  if (["inventaire", "inventory"].includes(lower)) {
    return startInventoryFlow(rid, to);
  }

  if (session) {
    return handleSessionFlow(rid, to, session, text);
  }

  // Numeric quick replies for interactive messages
  if (/^[1-3]$/.test(lower)) {
    return await handleQuickReply(rid, to, lower);
  }

  // Keyword actions
  if (lower.includes("commander") || lower === "1") {
    return await handleAlertOrder(rid, to);
  }
  if (lower.includes("valider") && !lower.includes("inventaire")) {
    return await handleValidateOrder(rid, to);
  }
  if (lower.includes("annuler")) {
    return await handleCancelOrder(rid, to);
  }

  // Pointage : « Julie 18:05 » / « Julie départ 23:00 »
  const pointage = parsePointageMessage(text);
  if (pointage) {
    return handlePointage(rid, to, pointage);
  }

  // Voice intent fallback
  const intent = parseVoiceIntent(text);
  if (intent.type !== "unknown") {
    await upsertSession(rid, to, {
      flow: "voice_confirm",
      payload: { intent, raw: text },
    });
    return `J'ai compris :\n${formatVoiceIntentSummary(intent)}\n\nRépondez 1 pour confirmer, 2 pour annuler.`;
  }

  return menuHelp();
}

async function handlePointage(
  restaurantId: string,
  phone: string,
  pointage: NonNullable<ReturnType<typeof parsePointageMessage>>
): Promise<string> {
  const hh = String(pointage.hours).padStart(2, "0");
  const mm = String(pointage.minutes).padStart(2, "0");
  const timeLabel = `${hh}:${mm}`;

  if (pointage.kind === "in") {
    const res = await clockInByName(restaurantId, pointage.name, {
      hours: pointage.hours,
      minutes: pointage.minutes,
    });
    await logAction(restaurantId, phone, "pointage_in", {
      query: pointage.name,
      time: timeLabel,
      ok: res.ok,
    });
    if (!res.ok) return res.error;
    const late =
      res.lateMinutes > 5
        ? ` (retard ${res.lateMinutes} min)`
        : "";
    return `✅ ${res.employee} pointé(e) à ${timeLabel}${late}.\nHeures & salaire estimé → Équipe (ordinateur).`;
  }

  const res = await clockOutByName(restaurantId, pointage.name, {
    hours: pointage.hours,
    minutes: pointage.minutes,
  });
  await logAction(restaurantId, phone, "pointage_out", {
    query: pointage.name,
    time: timeLabel,
    ok: res.ok,
  });
  if (!res.ok) return res.error;
  return `✅ ${res.employee} parti(e) à ${timeLabel} — ${res.hours.toFixed(1)} h aujourd’hui.\nRécap mensuel → Équipe (ordinateur).`;
}

function menuHelp(): string {
  return [
    "Margin — Commandes disponibles :",
    "",
    "• Pointage : Julie 18:05",
    "• Départ : Julie départ 23:00",
    "• inventaire — lancer une vérification guidé",
    "• 1 — Commander (alerte stock)",
    "• 2 — Valider commande fournisseur",
    "• 3 — Annuler commande",
    "",
    "Ou envoyez un vocal : « Tomates 5 kg, Salade 2 kg »",
  ].join("\n");
}

async function handleQuickReply(
  restaurantId: string,
  phone: string,
  choice: string
): Promise<string> {
  const session = await getSession(restaurantId, phone);
  if (session?.flow === "voice_confirm") {
    const payload = JSON.parse(session.payload || "{}") as {
      intent?: ReturnType<typeof parseVoiceIntent>;
    };
    if (choice === "1" && payload.intent) {
      await clearSession(restaurantId, phone);
      return applyVoiceIntent(restaurantId, phone, payload.intent);
    }
    await clearSession(restaurantId, phone);
    return "Annulé.";
  }

  if (session?.flow === "inventory") {
    return handleInventoryStep(restaurantId, phone, session, choice);
  }

  if (session?.flow === "delivery") {
    return handleDeliveryChoice(restaurantId, phone, session, choice);
  }

  switch (choice) {
    case "1":
      return handleAlertOrder(restaurantId, phone);
    case "2":
      return handleValidateOrder(restaurantId, phone);
    case "3":
      return handleCancelOrder(restaurantId, phone);
    default:
      return menuHelp();
  }
}

async function handleSessionFlow(
  restaurantId: string,
  phone: string,
  session: { flow: string; step: number; payload: string },
  text: string
): Promise<string> {
  if (session.flow === "inventory") {
    return handleInventoryStep(restaurantId, phone, session, text);
  }
  if (session.flow === "delivery") {
    return handleDeliveryChoice(restaurantId, phone, session, text);
  }
  if (session.flow === "voice_confirm") {
    return handleQuickReply(restaurantId, phone, text);
  }
  await clearSession(restaurantId, phone);
  return menuHelp();
}

async function handleAlertOrder(restaurantId: string, phone: string): Promise<string> {
  const result = await proposePurchaseOrders(restaurantId);
  await logAction(restaurantId, phone, "alert_order", result);

  if (result.created === 0) {
    return result.message;
  }

  const orders = await prisma.purchaseOrder.findMany({
    where: { restaurantId, status: "TO_VALIDATE" },
    include: { supplier: true, lines: { include: { ingredient: true } } },
    take: 3,
  });

  const summary = orders
    .map(
      (o) =>
        `• ${o.supplier.name} — ${o.totalAmount.toFixed(2)} € (${o.lines.length} lignes)`
    )
    .join("\n");

  return `Commande(s) proposée(s) :\n${summary}\n\nRépondez 2 pour valider ou 3 pour annuler.`;
}

async function handleValidateOrder(restaurantId: string, phone: string): Promise<string> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { restaurantId, status: "TO_VALIDATE" },
    include: { supplier: true },
    orderBy: { proposedAt: "desc" },
  });

  if (!order) {
    return "Aucune commande en attente de validation.";
  }

  await validatePurchaseOrder(restaurantId, order.id);
  await logAction(restaurantId, phone, "validate_order", { orderId: order.id });

  return `Commande validée et envoyée à ${order.supplier.name} (${order.totalAmount.toFixed(2)} €).`;
}

async function handleCancelOrder(restaurantId: string, phone: string): Promise<string> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { restaurantId, status: "TO_VALIDATE" },
    orderBy: { proposedAt: "desc" },
  });

  if (!order) {
    return "Aucune commande à annuler.";
  }

  await cancelPurchaseOrder(restaurantId, order.id);
  await logAction(restaurantId, phone, "cancel_order", { orderId: order.id });

  return "Commande annulée.";
}

async function startInventoryFlow(
  restaurantId: string,
  phone: string
): Promise<string> {
  const existing = await prisma.inventoryCount.findFirst({
    where: { restaurantId, status: "DRAFT" },
    include: { lines: { include: { ingredient: true }, orderBy: { ingredient: { name: "asc" } } } },
  });

  const inv =
    existing ??
    (await createDraftInventory(restaurantId, "WhatsApp"));

  const lines = inv.lines ?? [];
  if (!lines.length) {
    return "Aucun ingrédient à compter.";
  }

  await upsertSession(restaurantId, phone, {
    flow: "inventory",
    step: 0,
    payload: {
      inventoryId: inv.id,
      lineIds: lines.map((l) => l.id),
    },
  });

  const line = lines[0];
  return `Inventaire — produit 1/${lines.length}\n${line.ingredient.name}\nThéorique : ${formatQty(line.theoreticalQty, line.ingredient.unit)}\n\nRépondez avec la quantité comptée (ex: 12.5).`;
}

async function handleInventoryStep(
  restaurantId: string,
  phone: string,
  session: { step: number; payload: string },
  text: string
): Promise<string> {
  const payload = JSON.parse(session.payload || "{}") as {
    inventoryId: string;
    lineIds: string[];
  };

  const qty = parseFloat(text.replace(",", "."));
  if (!Number.isFinite(qty) || qty < 0) {
    return "Quantité invalide. Répondez avec un nombre (ex: 5 ou 2.5).";
  }

  const lineId = payload.lineIds[session.step];
  await updateInventoryLines(restaurantId, payload.inventoryId, [
    { lineId, countedQty: qty },
  ]);

  const nextStep = session.step + 1;

  if (nextStep >= payload.lineIds.length) {
    await validateInventory(restaurantId, payload.inventoryId);
    await clearSession(restaurantId, phone);
    await logAction(restaurantId, phone, "inventory_validated", {
      inventoryId: payload.inventoryId,
    });
    return `Inventaire terminé (${payload.lineIds.length} produits). Stock recalé.`;
  }

  const inv = await prisma.inventoryCount.findFirst({
    where: { id: payload.inventoryId, restaurantId },
    include: {
      lines: {
        where: { id: payload.lineIds[nextStep] },
        include: { ingredient: true },
      },
    },
  });

  const line = inv?.lines[0];
  if (!line) {
    await clearSession(restaurantId, phone);
    return "Erreur inventaire. Tapez « inventaire » pour recommencer.";
  }

  await upsertSession(restaurantId, phone, {
    flow: "inventory",
    step: nextStep,
    payload,
  });

  return `Produit ${nextStep + 1}/${payload.lineIds.length}\n${line.ingredient.name}\nThéorique : ${formatQty(line.theoreticalQty, line.ingredient.unit)}\n\nQuantité comptée ?`;
}

async function handleDeliveryChoice(
  restaurantId: string,
  phone: string,
  session: { payload: string },
  text: string
): Promise<string> {
  const payload = JSON.parse(session.payload || "{}") as {
    orderId: string;
    driverIds: string[];
  };

  const idx = parseInt(text, 10) - 1;
  if (idx >= 0 && idx < payload.driverIds.length) {
    const driverId = payload.driverIds[idx];
    await assignDriver(restaurantId, payload.orderId, driverId);
    await clearSession(restaurantId, phone);
    await logAction(restaurantId, phone, "assign_driver", {
      orderId: payload.orderId,
      driverId,
    });
    const driver = await prisma.deliveryDriver.findUnique({
      where: { id: driverId },
    });
    return `Livreur ${driver?.name ?? ""} assigné. Commande en route.`;
  }

  if (text.toLowerCase().includes("livré") || text === "4") {
    await updateDeliveryStatus(restaurantId, payload.orderId, "DELIVERED");
    await clearSession(restaurantId, phone);
    return "Commande marquée livrée.";
  }

  return "Choix invalide. Répondez avec le numéro du livreur.";
}

async function applyVoiceIntent(
  restaurantId: string,
  phone: string,
  intent: ReturnType<typeof parseVoiceIntent>
): Promise<string> {
  if (intent.type === "inventory") {
    const draft = await prisma.inventoryCount.findFirst({
      where: { restaurantId, status: "DRAFT" },
      include: { lines: { include: { ingredient: true } } },
    });
    if (!draft) {
      return "Lancez d'abord un inventaire (tapez « inventaire »).";
    }

    const updates: { lineId: string; countedQty: number }[] = [];
    for (const item of intent.items) {
      const line = draft.lines.find((l) =>
        l.ingredient.name.toLowerCase().includes(item.name.toLowerCase())
      );
      if (line) {
        let qty = item.quantity;
        if (item.unit === "kg" && line.ingredient.unit === "g") qty *= 1000;
        if (item.unit === "l" && line.ingredient.unit === "ml") qty *= 1000;
        updates.push({ lineId: line.id, countedQty: qty });
      }
    }

    if (!updates.length) {
      return "Aucun ingrédient reconnu. Vérifiez les noms.";
    }

    await updateInventoryLines(restaurantId, draft.id, updates);
    await logAction(restaurantId, phone, "voice_inventory", { count: updates.length });
    return `${updates.length} ligne(s) mise(s) à jour. Tapez « inventaire » pour continuer ou valider depuis le dashboard.`;
  }

  if (intent.type === "recipe") {
    await logAction(restaurantId, phone, "voice_recipe", {
      dish: intent.dishName,
      items: intent.items.length,
    });
    return `Recette « ${intent.dishName} » reçue (${intent.items.length} ingrédients). Finalisez depuis Recettes dans l'app.`;
  }

  return "Je n'ai pas compris. Réessayez ou tapez « aide ».";
}

async function downloadTwilioMedia(url: string): Promise<Buffer | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Send interactive alert with numbered options */
export async function sendInteractiveAlert(
  restaurantId: string,
  to: string,
  title: string,
  body: string,
  options: InteractiveOption[]
) {
  const notifier = getNotifier();
  const lines = options.map((o, i) => `${i + 1}️⃣ ${o.label}`).join("\n");
  await notifier.send({
    to,
    body: `${title}\n\n${body}\n\n${lines}\n\nRépondez avec le numéro.`,
  });
}

/** Notify PO ready for validation */
export async function notifyPurchaseOrderWhatsApp(
  restaurantId: string,
  orderId: string
) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant?.whatsappTo) return;

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, restaurantId },
    include: { supplier: true, lines: { include: { ingredient: true } } },
  });
  if (!order) return;

  const summary = order.lines
    .slice(0, 3)
    .map(
      (l) =>
        `• ${l.ingredient.name} × ${formatQty(l.quantity, l.ingredient.unit)}`
    )
    .join("\n");

  await sendInteractiveAlert(
    restaurantId,
    restaurant.whatsappTo,
    `Commande ${order.supplier.name}`,
    `${summary}\nTotal : ${order.totalAmount.toFixed(2)} €`,
    [
      { id: "validate", label: "Valider" },
      { id: "cancel", label: "Annuler" },
    ]
  );
}

/** Notify delivery order and offer driver assignment */
export async function notifyDeliveryOrderWhatsApp(
  restaurantId: string,
  orderId: string
) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant?.whatsappTo) return;

  const order = await prisma.deliveryOrder.findFirst({
    where: { id: orderId, restaurantId },
  });
  if (!order) return;

  const drivers = await getActiveDrivers(restaurantId);
  if (!drivers.length) {
    const notifier = getNotifier();
    await notifier.send({
      to: restaurant.whatsappTo,
      body: `Livraison #${order.externalOrderId.slice(-6)} prête (${order.totalAmount.toFixed(2)} €). Ajoutez un livreur dans Livraison.`,
    });
    return;
  }

  await upsertSession(restaurantId, restaurant.whatsappTo, {
    flow: "delivery",
    payload: {
      orderId,
      driverIds: drivers.map((d) => d.id),
    },
  });

  const lines = drivers
    .map((d, i) => `${i + 1}️⃣ Assigner ${d.name}`)
    .join("\n");

  const notifier = getNotifier();
  await notifier.send({
    to: restaurant.whatsappTo,
    body: `Commande livraison prête (#${order.externalOrderId.slice(-6)})\n${lines}\n4️⃣ Marquer livré`,
  });
}

export { normalizePhone, phonesMatch, logAction };
