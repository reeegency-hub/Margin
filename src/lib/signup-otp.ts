import { createHash, randomInt } from "crypto";

const OTP_TTL_MS = 10 * 60 * 1000;
export const SIGNUP_OTP_TTL_MS = OTP_TTL_MS;
const OTP_MAX_ATTEMPTS = 5;

export function isSignupOtpEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function isSignupOtpSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_SMS_FROM || process.env.TWILIO_PHONE_NUMBER)
  );
}

export function canSendSignupOtp(channel: "email" | "sms"): boolean {
  if (channel === "sms") return isSignupOtpSmsConfigured();
  if (isSignupOtpEmailConfigured()) return true;
  // Dev / pilote local : console OK hors production
  return process.env.NODE_ENV !== "production";
}

function pepper(): string {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.CREDENTIALS_ENCRYPTION_KEY ||
    "margin-otp-dev"
  );
}

export function hashOtpCode(email: string, code: string): string {
  return createHash("sha256")
    .update(`${pepper()}:${email.trim().toLowerCase()}:${code}`)
    .digest("hex");
}

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

/** Normalise FR → E.164 approximatif (+33…). */
export function normalizePhoneE164(raw: string): string | null {
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  let n = digits;
  if (n.startsWith("00")) n = `+${n.slice(2)}`;
  if (n.startsWith("0") && n.length === 10) n = `+33${n.slice(1)}`;
  if (!n.startsWith("+")) n = `+${n}`;
  if (!/^\+[1-9]\d{8,14}$/.test(n)) return null;
  return n;
}

export async function createAndSendSignupOtp(opts: {
  email: string;
  channel: "email" | "sms";
  phone?: string | null;
}): Promise<
  | {
      ok: true;
      challengeId: string;
      channel: "email" | "sms";
      expiresInSec: number;
      /** Uniquement hors prod sans provider */
      devCode?: string;
    }
  | { ok: false; error: string }
> {
  const { prisma } = await import("@/lib/db");
  const email = String(opts.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Email invalide." };
  }

  const channel = opts.channel === "sms" ? "sms" : "email";
  if (!canSendSignupOtp(channel)) {
    return {
      ok: false,
      error:
        channel === "sms"
          ? "SMS non configuré (Twilio). Utilisez l’email."
          : "Envoi email OTP non configuré (RESEND_API_KEY).",
    };
  }

  let phone: string | null = null;
  if (channel === "sms") {
    phone = normalizePhoneE164(String(opts.phone || ""));
    if (!phone) {
      return {
        ok: false,
        error: "Numéro invalide (ex. +33612345678).",
      };
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { ok: false, error: "Cet email existe déjà. Connectez-vous." };
  }

  const code = generateCode();
  const codeHash = hashOtpCode(email, code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.signupOtpChallenge.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const challenge = await prisma.signupOtpChallenge.create({
    data: {
      email,
      phone,
      channel,
      codeHash,
      expiresAt,
    },
  });

  const sent =
    channel === "sms"
      ? await sendOtpSms(phone!, code)
      : await sendOtpEmail(email, code);

  if (!sent.ok) {
    await prisma.signupOtpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, error: sent.error };
  }

  const devCode =
    process.env.NODE_ENV !== "production" && sent.via === "console"
      ? code
      : undefined;

  return {
    ok: true,
    challengeId: challenge.id,
    channel,
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
    devCode,
  };
}

export async function consumeSignupOtp(opts: {
  email: string;
  code: string;
  challengeId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { prisma } = await import("@/lib/db");
  const email = String(opts.email || "").trim().toLowerCase();
  const code = String(opts.code || "").trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Code à 6 chiffres requis." };
  }

  const challenge = opts.challengeId
    ? await prisma.signupOtpChallenge.findUnique({
        where: { id: opts.challengeId },
      })
    : await prisma.signupOtpChallenge.findFirst({
        where: { email, consumedAt: null },
        orderBy: { createdAt: "desc" },
      });

  if (!challenge || challenge.email !== email) {
    return { ok: false, error: "Demandez d’abord un code de vérification." };
  }
  if (challenge.consumedAt) {
    return { ok: false, error: "Code déjà utilisé. Demandez-en un nouveau." };
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Code expiré. Demandez-en un nouveau." };
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Trop d’essais. Demandez un nouveau code.",
    };
  }

  const expected = hashOtpCode(email, code);
  if (expected !== challenge.codeHash) {
    await prisma.signupOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "Code incorrect." };
  }

  await prisma.signupOtpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}

async function sendOtpEmail(
  email: string,
  code: string
): Promise<{ ok: true; via: "resend" | "console" } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const subject = `${code} — code Margin`;
  const text = `Votre code de vérification Margin : ${code}\nValable 10 minutes.\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;color:#111">
      <p>Votre code de vérification Margin :</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
      <p style="font-size:13px;color:#666">Valable 10 minutes. Ne le partagez pas.</p>
    </div>
  `;

  if (!key) {
    console.info(`[signup-otp] console email → ${email} code=${code}`);
    return { ok: true, via: "console" };
  }

  const { sendResendEmail } = await import("@/lib/resend-from");
  const sent = await sendResendEmail({ to: email, subject, html, text });
  if (!sent.ok) {
    return {
      ok: false,
      error:
        "Email indisponible tant que le domaine Resend n’est pas vérifié. Utilisez le SMS, ou l’adresse liée au compte Resend.",
    };
  }
  return { ok: true, via: "resend" };
}

async function sendOtpSms(
  phone: string,
  code: string
): Promise<{ ok: true; via: "twilio" | "console" } | { ok: false; error: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from =
    process.env.TWILIO_SMS_FROM || process.env.TWILIO_PHONE_NUMBER || "";

  if (!sid || !token || !from) {
    console.info(`[signup-otp] console sms → ${phone} code=${code}`);
    return { ok: true, via: "console" };
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(sid, token);
    await client.messages.create({
      from,
      to: phone,
      body: `Margin : votre code est ${code} (valable 10 min).`,
    });
    return { ok: true, via: "twilio" };
  } catch (err) {
    console.error("[signup-otp] sms failed", err);
    return { ok: false, error: "Impossible d’envoyer le SMS. Réessayez." };
  }
}
