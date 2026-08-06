/** Transcribe audio buffer via OpenAI Whisper API */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = "audio/ogg"
): Promise<{ text: string; engine: "whisper" | "none" }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { text: "", engine: "none" };
  }

  const ext = mimeType.includes("mpeg") ? "mp3" : mimeType.includes("wav") ? "wav" : "ogg";
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(audioBuffer)], { type: mimeType }),
    `audio.${ext}`
  );
  form.append("model", "whisper-1");
  form.append("language", "fr");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    console.error("[voice-stt] Whisper error", await res.text());
    return { text: "", engine: "none" };
  }

  const data = (await res.json()) as { text?: string };
  return { text: (data.text || "").trim(), engine: "whisper" };
}
