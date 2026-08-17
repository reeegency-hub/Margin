/** Codes et liens de parrainage ambassadeur (≠ referralCode magasin→magasin). */

export function normalizeAmbassadorCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/** Code lisible à l’oral, préfixe AMB- pour éviter collision avec MS- commerce. */
export function codeFromAmbassador(name: string, id: string): string {
  const slug =
    name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 12) || "PARTNER";
  const suffix = id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return `AMB-${slug}${suffix ? `-${suffix}` : ""}`;
}

export function ambassadorSignupPath(code: string): string {
  return `/signup?amb=${encodeURIComponent(code)}`;
}

export function absoluteAmbassadorSignupUrl(code: string, baseUrl?: string): string {
  const base = (
    baseUrl ||
    process.env.NEXTAUTH_URL ||
    "https://margin-shop.vercel.app"
  ).replace(/\/$/, "");
  return `${base}${ambassadorSignupPath(code)}`;
}
