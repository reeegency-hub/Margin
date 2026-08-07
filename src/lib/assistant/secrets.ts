/**
 * Détection secrets collés dans le chat — jamais traités par le LLM setup.
 */
const SECRET_PATTERNS: { code: string; re: RegExp; message: string }[] = [
  {
    code: "api_key_like",
    re: /\b(sk_live_[A-Za-z0-9]+|sk_test_[A-Za-z0-9]+|rk_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|AKIA[0-9A-Z]{16}|re_[A-Za-z0-9]{20,})\b/i,
    message:
      "Une clé / secret a été détecté. Annulez et utilisez le wizard caisse ou Réglages — ne collez jamais de mots de passe ici.",
  },
  {
    code: "password_phrase",
    re: /\b(mot\s*de\s*passe|password|secret\s*webhook|api\s*key|clé\s*api)\s*[:=]\s*\S+/i,
    message:
      "Ne collez pas de mot de passe ou clé API dans le chat. Ouvrez le wizard dédié.",
  },
  {
    code: "bearer",
    re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/i,
    message: "Token détecté — retirez-le du message et utilisez le wizard.",
  },
];

export function detectSecretsInText(text: string): string | null {
  const raw = String(text || "");
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(raw)) return p.message;
  }
  return null;
}

export function scrubSecretsForLog(text: string): string {
  return String(text || "")
    .replace(/\bsk_(live|test)_[A-Za-z0-9]+/gi, "sk_***")
    .replace(/\bwhsec_[A-Za-z0-9]+/gi, "whsec_***")
    .replace(/\bre_[A-Za-z0-9]+/gi, "re_***")
    .replace(/\bBearer\s+\S+/gi, "Bearer ***");
}
