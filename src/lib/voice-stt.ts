import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/credentials";
import { decryptLlmKey } from "@/lib/llm/crypto";

export const SALE_AUDIO_MAX_BYTES = 800_000;
export const SALE_AUDIO_MAX_SEC = 20;

function whisperFilename(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("mpeg") || m.includes("mp3")) return "audio.mp3";
  if (m.includes("wav")) return "audio.wav";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac"))
    return "audio.m4a";
  if (m.includes("ogg")) return "audio.ogg";
  return "audio.webm";
}

async function resolveWhisperApiKey(tenantId?: string): Promise<string | null> {
  if (tenantId) {
    try {
      const row = await prisma.llmProviderCredential.findFirst({
        where: {
          restaurantId: tenantId,
          provider: "openai",
          status: { in: ["untested", "valid"] },
          encryptedKey: { not: null },
        },
        orderBy: { updatedAt: "desc" },
        select: { encryptedKey: true, encryptionIv: true },
      });
      const byok = decryptLlmKey(row?.encryptedKey, row?.encryptionIv);
      if (byok.startsWith("sk-")) return byok;
    } catch {
      /* table absente ou clé illisible */
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: tenantId },
      select: { openaiApiKeyEncrypted: true },
    });
    const legacy = decryptCredential(restaurant?.openaiApiKeyEncrypted);
    if (legacy.startsWith("sk-")) return legacy;
  }

  const platform = (process.env.OPENAI_API_KEY || "").trim();
  return platform.startsWith("sk-") ? platform : null;
}

/** Transcribe audio buffer via OpenAI Whisper API */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = "audio/ogg",
  tenantId?: string
): Promise<{ text: string; engine: "whisper" | "none" }> {
  const apiKey = await resolveWhisperApiKey(tenantId);
  if (!apiKey) {
    return { text: "", engine: "none" };
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(audioBuffer)], { type: mimeType }),
    whisperFilename(mimeType)
  );
  form.append("model", "whisper-1");
  form.append("language", "fr");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    console.error("[voice-stt] Whisper error", res.status);
    return { text: "", engine: "none" };
  }

  const data = (await res.json()) as { text?: string };
  return { text: (data.text || "").trim(), engine: "whisper" };
}
