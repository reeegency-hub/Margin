import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret =
    process.env.CREDENTIALS_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "dev-fallback-key-change-in-prod";
  return scryptSync(secret, "restaurantos-salt", 32);
}

export function encryptCredential(plain: string): string {
  if (!plain) return "";
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptCredential(encrypted: string | null | undefined): string {
  if (!encrypted) return "";
  try {
    const buf = Buffer.from(encrypted, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const key = getKey();
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8"
    );
  } catch {
    return "";
  }
}

export function maskCredential(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.min(value.length - 4, 12))}${value.slice(-4)}`;
}

export function generateWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}
