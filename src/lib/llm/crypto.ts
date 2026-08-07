import { createHash } from "crypto";
import {
  decryptCredential,
  encryptCredential,
  maskCredential,
} from "@/lib/credentials";

/** Empreinte stockée — jamais la clé entière. */
export function keyFingerprint(apiKey: string): string {
  return createHash("sha256").update(apiKey.slice(-8)).digest("hex").slice(0, 16);
}

export function encryptLlmKey(apiKey: string): {
  encryptedKey: string;
  encryptionIv: string | null;
} {
  return {
    encryptedKey: encryptCredential(apiKey),
    encryptionIv: null, // IV embarqué dans le blob AES-GCM
  };
}

export function decryptLlmKey(
  encryptedKey: string | null | undefined,
  _encryptionIv?: string | null
): string {
  void _encryptionIv;
  return decryptCredential(encryptedKey);
}

export function maskLlmKey(apiKey: string): string {
  return maskCredential(apiKey);
}
