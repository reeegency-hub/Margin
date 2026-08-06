/**
 * Calendly — démo / config WhatsApp 30 min.
 * Définir NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/votre-compte/30min
 */

export function getCalendlyUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_CALENDLY_URL || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes("calendly.com")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function calendlyEmbedUrl(base: string): string {
  const u = new URL(base);
  if (!u.searchParams.has("hide_gdpr_banner")) {
    u.searchParams.set("hide_gdpr_banner", "1");
  }
  return u.toString();
}
