import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { applyTwilioStatusUpdate } from "@/lib/whatsapp/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Twilio statusCallback — délivrabilité réelle (sent / delivered / failed…).
 * Configuré automatiquement sur chaque envoi via WEBHOOK_BASE_URL.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const messageSid = String(form.get("MessageSid") || form.get("SmsSid") || "");
  const messageStatus = String(
    form.get("MessageStatus") || form.get("SmsStatus") || ""
  );
  const errorCode = form.get("ErrorCode")
    ? String(form.get("ErrorCode"))
    : null;
  const errorMessage = form.get("ErrorMessage")
    ? String(form.get("ErrorMessage"))
    : null;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers.get("x-twilio-signature") || "";
  const url = process.env.WEBHOOK_BASE_URL
    ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/twilio/status`
    : req.url;

  if (authToken && signature) {
    const valid = twilio.validateRequest(
      authToken,
      signature,
      url,
      Object.fromEntries(form.entries()) as Record<string, string>
    );
    if (!valid && process.env.NODE_ENV === "production") {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  if (!messageSid || !messageStatus) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
  }

  const updated = await applyTwilioStatusUpdate({
    messageSid,
    messageStatus,
    errorCode,
    errorMessage,
  });

  return NextResponse.json({ ok: true, updated });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "twilio-status-callback",
      method: "POST only",
      hint:
        "Endpoint OK. Dans Twilio, collez cette URL comme Status Callback (HTTP POST) sur le sender WhatsApp / SMS - ne l'ouvrez pas dans le navigateur.",
      url: "https://margin-shop.vercel.app/api/webhooks/twilio/status",
    },
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
}
