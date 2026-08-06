/**
 * Envoi WhatsApp unifié — templates, plafond journalier, journal + statusCallback.
 */
import { prisma } from "@/lib/db";
import {
  WHATSAPP_COST_CENTS,
  WHATSAPP_DAILY_LIMIT,
  countsTowardDailyLimit,
  isTwilioConfigured,
  requireWhatsAppTemplates,
  type WhatsAppPurpose,
} from "@/lib/whatsapp/config";
import {
  resolveTemplate,
  templateSidForPurpose,
} from "@/lib/whatsapp/templates";

export type SendWhatsAppInput = {
  to: string;
  restaurantId?: string | null;
  purpose: WhatsAppPurpose;
  /** Corps freeform (session / fallback) */
  body?: string;
  templateKey?: string;
  templateVars?: Record<string, string>;
  alertIds?: string[];
  /** Force freeform même en prod (réponses session 24h) */
  allowSessionFreeform?: boolean;
};

export type SendWhatsAppResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
  twilioSid?: string | null;
  channel: "twilio" | "console";
  status: string;
};

function maskPhone(to: string): string {
  const digits = to.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

function statusCallbackUrl(): string | undefined {
  const base = (
    process.env.WEBHOOK_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    ""
  ).replace(/\/$/, "");
  if (!base) return undefined;
  return `${base}/api/webhooks/twilio/status`;
}

export async function countTenantMessagesToday(
  restaurantId: string
): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.whatsAppOutboundMessage.count({
    where: {
      restaurantId,
      createdAt: { gte: start },
      status: { not: "limit_skipped" },
      purpose: {
        in: [
          "stock_recap",
          "stock_alert",
          "billing_dunning",
          "test",
          "delivery",
          "other",
        ],
      },
    },
  });
}

async function notifyOps(message: string, restaurantId?: string | null) {
  const text = `[WA] tenant=${restaurantId || "*"} — ${message}`;
  const url = process.env.OPS_SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn(text);
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    console.warn(text);
  }
}

export async function sendWhatsAppOutbound(
  input: SendWhatsAppInput
): Promise<SendWhatsAppResult> {
  const channel = isTwilioConfigured() ? "twilio" : "console";
  const template = input.templateKey
    ? resolveTemplate(input.templateKey)
    : null;
  const vars = input.templateVars || {};
  const contentSid =
    template?.contentSid ||
    (!input.allowSessionFreeform
      ? templateSidForPurpose(input.purpose)
      : null);
  const body =
    input.body ||
    template?.fallbackBody(vars) ||
    Object.values(vars).filter(Boolean).join("\n");

  const needsTemplate =
    !input.allowSessionFreeform &&
    countsTowardDailyLimit(input.purpose) &&
    requireWhatsAppTemplates();

  if (needsTemplate && !contentSid && channel === "twilio") {
    const row = await prisma.whatsAppOutboundMessage.create({
      data: {
        restaurantId: input.restaurantId || null,
        purpose: input.purpose,
        channel,
        templateKey: input.templateKey || input.purpose,
        status: "failed",
        errorMessage: "Template Content SID manquant",
        bodyPreview: body.slice(0, 280),
        estimatedCostCents: 0,
        alertIdsJson: input.alertIds
          ? JSON.stringify(input.alertIds)
          : null,
        toMasked: maskPhone(input.to),
        statusUpdatedAt: new Date(),
      },
    });
    await notifyOps(
      `Envoi bloqué — template ${input.purpose} non configuré`,
      input.restaurantId
    );
    return {
      ok: false,
      reason: "Template WhatsApp manquant (Content SID)",
      messageId: row.id,
      channel,
      status: "failed",
    };
  }

  if (
    input.restaurantId &&
    countsTowardDailyLimit(input.purpose)
  ) {
    const used = await countTenantMessagesToday(input.restaurantId);
    if (used >= WHATSAPP_DAILY_LIMIT) {
      const row = await prisma.whatsAppOutboundMessage.create({
        data: {
          restaurantId: input.restaurantId,
          purpose: input.purpose,
          channel,
          templateKey: input.templateKey || null,
          status: "limit_skipped",
          errorMessage: `Plafond journalier ${WHATSAPP_DAILY_LIMIT} atteint`,
          bodyPreview: body.slice(0, 280),
          estimatedCostCents: 0,
          alertIdsJson: input.alertIds
            ? JSON.stringify(input.alertIds)
            : null,
          toMasked: maskPhone(input.to),
          statusUpdatedAt: new Date(),
        },
      });
      await notifyOps(
        `Plafond WA journalier atteint (${WHATSAPP_DAILY_LIMIT}) — calibrage seuils à vérifier`,
        input.restaurantId
      );
      return {
        ok: false,
        skipped: true,
        reason: `Limite journalière ${WHATSAPP_DAILY_LIMIT} messages atteinte`,
        messageId: row.id,
        channel,
        status: "limit_skipped",
      };
    }
  }

  const row = await prisma.whatsAppOutboundMessage.create({
    data: {
      restaurantId: input.restaurantId || null,
      purpose: input.purpose,
      channel,
      templateKey: input.templateKey || (contentSid ? input.purpose : null),
      status: "queued",
      bodyPreview: body.slice(0, 280),
      estimatedCostCents: WHATSAPP_COST_CENTS,
      alertIdsJson: input.alertIds ? JSON.stringify(input.alertIds) : null,
      toMasked: maskPhone(input.to),
    },
  });

  if (channel === "console") {
    console.log("[WhatsApp:console]", {
      to: input.to,
      purpose: input.purpose,
      body,
      template: contentSid,
    });
    await prisma.whatsAppOutboundMessage.update({
      where: { id: row.id },
      data: {
        status: "delivered",
        statusUpdatedAt: new Date(),
      },
    });
    return {
      ok: true,
      messageId: row.id,
      twilioSid: null,
      channel: "console",
      status: "delivered",
    };
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
    const to = input.to.startsWith("whatsapp:")
      ? input.to
      : `whatsapp:${input.to}`;
    const from = process.env.TWILIO_WHATSAPP_FROM!;
    const callback = statusCallbackUrl();

    const createParams: {
      from: string;
      to: string;
      statusCallback?: string;
      contentSid?: string;
      contentVariables?: string;
      body?: string;
    } = {
      from,
      to,
      statusCallback: callback,
    };
    if (contentSid && !input.allowSessionFreeform) {
      createParams.contentSid = contentSid;
      createParams.contentVariables = JSON.stringify(
        Object.fromEntries(
          Object.entries(vars).map(([k, v]) => [k, String(v).slice(0, 1024)])
        )
      );
    } else {
      createParams.body = body;
    }

    const msg = await client.messages.create(createParams);

    await prisma.whatsAppOutboundMessage.update({
      where: { id: row.id },
      data: {
        twilioSid: msg.sid,
        status: msg.status || "accepted",
        statusUpdatedAt: new Date(),
      },
    });

    return {
      ok: true,
      messageId: row.id,
      twilioSid: msg.sid,
      channel: "twilio",
      status: msg.status || "accepted",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.whatsAppOutboundMessage.update({
      where: { id: row.id },
      data: {
        status: "failed",
        errorMessage: msg.slice(0, 500),
        statusUpdatedAt: new Date(),
      },
    });
    console.error("[WhatsApp:twilio] send failed", msg);
    throw new Error(
      `Échec envoi WhatsApp Twilio : ${msg}. Vérifiez le sandbox / le numéro.`
    );
  }
}

export async function applyTwilioStatusUpdate(opts: {
  messageSid: string;
  messageStatus: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<boolean> {
  const row = await prisma.whatsAppOutboundMessage.findUnique({
    where: { twilioSid: opts.messageSid },
  });
  if (!row) return false;

  await prisma.whatsAppOutboundMessage.update({
    where: { id: row.id },
    data: {
      status: opts.messageStatus,
      errorCode: opts.errorCode || null,
      errorMessage: opts.errorMessage
        ? opts.errorMessage.slice(0, 500)
        : row.errorMessage,
      statusUpdatedAt: new Date(),
    },
  });

  if (
    opts.messageStatus === "failed" ||
    opts.messageStatus === "undelivered"
  ) {
    await notifyOps(
      `Délivrance échouée sid=${opts.messageSid} status=${opts.messageStatus} code=${opts.errorCode || "—"}`,
      row.restaurantId
    );
  }

  return true;
}
