/**
 * Validation format-only des clés BYOK (zéro appel provider à la saisie).
 */
export type LlmProvider = "anthropic" | "openai";

const KEY_PATTERNS: Record<LlmProvider, RegExp> = {
  anthropic: /^sk-ant-[a-zA-Z0-9\-_]{20,}$/,
  openai: /^sk-[a-zA-Z0-9\-_]{20,}$/,
};

export function validateKeyFormat(
  provider: LlmProvider,
  apiKey: string
): { ok: true } | { ok: false; message: string } {
  const pattern = KEY_PATTERNS[provider];
  if (!pattern.test(apiKey.trim())) {
    return {
      ok: false,
      message:
        provider === "anthropic"
          ? "Format invalide — une clé Anthropic commence par sk-ant-…"
          : "Format invalide — une clé OpenAI commence par sk-…",
    };
  }
  return { ok: true };
}

export function displayFingerprint(provider: LlmProvider, last4: string): string {
  const prefix = provider === "anthropic" ? "sk-ant-…" : "sk-…";
  return `${prefix}${last4}`;
}
