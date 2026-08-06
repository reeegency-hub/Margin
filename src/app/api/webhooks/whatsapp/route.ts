import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { handleWhatsAppInbound } from "@/lib/whatsapp-bot";
import { getNotifier } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const from = String(form.get("From") || "");
  const body = String(form.get("Body") || "");
  const numMedia = parseInt(String(form.get("NumMedia") || "0"), 10);
  let mediaUrl: string | undefined;
  let mediaType: string | undefined;

  if (numMedia > 0) {
    mediaUrl = String(form.get("MediaUrl0") || "");
    mediaType = String(form.get("MediaContentType0") || "");
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers.get("x-twilio-signature") || "";
  const url =
    process.env.WEBHOOK_BASE_URL
      ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/whatsapp`
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

  const reply = await handleWhatsAppInbound({
    from,
    body,
    mediaUrl,
    mediaType,
  });

  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
  );
  return NextResponse.json({
    ok: true,
    bot: "active",
    twilio: hasTwilio,
    notifier: getNotifier().constructor.name,
  });
}
