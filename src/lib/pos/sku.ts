/**
 * Normalisation & matching SKU / code-barres (sync caisse temps réel).
 */
export function normalizeSku(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
  return cleaned.length ? cleaned : null;
}

/** Compare deux SKU après normalisation. */
export function skusEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizeSku(a);
  const nb = normalizeSku(b);
  if (!na || !nb) return false;
  return na === nb;
}
