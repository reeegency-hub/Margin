import {
  sendWhatsAppOutbound,
  type SendWhatsAppInput,
} from "@/lib/whatsapp/outbound";
import {
  isTwilioConfigured,
  type WhatsAppPurpose,
} from "@/lib/whatsapp/config";

export { isTwilioConfigured };

export type NotifyPayload = {
  to: string;
  body: string;
  restaurantId?: string | null;
  purpose?: WhatsAppPurpose;
  templateKey?: string;
  templateVars?: Record<string, string>;
  allowSessionFreeform?: boolean;
};

export type InteractiveOption = {
  id: string;
  label: string;
};

export interface Notifier {
  send(payload: NotifyPayload): Promise<void>;
  sendInteractive?(
    payload: NotifyPayload & { options: InteractiveOption[] }
  ): Promise<void>;
}

export class ConsoleNotifier implements Notifier {
  async send(payload: NotifyPayload): Promise<void> {
    await sendWhatsAppOutbound({
      to: payload.to,
      body: payload.body,
      restaurantId: payload.restaurantId,
      purpose: payload.purpose || "other",
      templateKey: payload.templateKey,
      templateVars: payload.templateVars,
      allowSessionFreeform: payload.allowSessionFreeform ?? true,
    });
  }
}

export class TwilioWhatsAppNotifier implements Notifier {
  async send(payload: NotifyPayload): Promise<void> {
    const input: SendWhatsAppInput = {
      to: payload.to,
        body: payload.body,
      restaurantId: payload.restaurantId,
      purpose: payload.purpose || "other",
      templateKey: payload.templateKey,
      templateVars: payload.templateVars,
      allowSessionFreeform:
        payload.allowSessionFreeform ??
        payload.purpose === "session_reply",
    };
    const result = await sendWhatsAppOutbound(input);
    if (!result.ok && !result.skipped) {
      throw new Error(result.reason || "Échec envoi WhatsApp");
    }
  }

  async sendInteractive(
    payload: NotifyPayload & { options: InteractiveOption[] }
  ): Promise<void> {
    const lines = payload.options
      .map((o, i) => `${i + 1}️⃣ ${o.label}`)
      .join("\n");
    await this.send({
      ...payload,
      body: `${payload.body}\n\n${lines}\n\nRépondez avec le numéro.`,
      allowSessionFreeform: true,
      purpose: payload.purpose || "session_reply",
    });
  }
}

export type NotifierChannel = "twilio" | "console";

export function getNotifierChannel(): NotifierChannel {
  return isTwilioConfigured() ? "twilio" : "console";
}

export function getNotifier(): Notifier {
  if (isTwilioConfigured()) {
    return new TwilioWhatsAppNotifier();
  }
  return new ConsoleNotifier();
}
