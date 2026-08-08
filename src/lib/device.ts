/**
 * Détection device Margin — cookie serveur (middleware) + override force-mobile.
 * Ne pas utiliser pour du responsive fin : garder les media queries CSS à l’intérieur
 * de chaque shell.
 */

export type DeviceType = "mobile" | "desktop";

/** Cookie posé par le middleware (UA). */
export const DEVICE_COOKIE = "device-type";

/** Override manuel `?mobile=1` (déjà utilisé dans l’app). */
export const FORCE_MOBILE_COOKIE = "margin_mobile";

const MOBILE_UA =
  /Mobile|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone/i;

export function isMobileUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return MOBILE_UA.test(ua);
}

export function resolveDeviceType(opts: {
  cookieDevice?: string | null;
  forceMobile?: boolean;
  userAgent?: string | null;
}): DeviceType {
  if (opts.forceMobile) return "mobile";
  if (opts.cookieDevice === "mobile" || opts.cookieDevice === "desktop") {
    return opts.cookieDevice;
  }
  return isMobileUserAgent(opts.userAgent) ? "mobile" : "desktop";
}

/** Lecture cookies Next (server components / layout). */
export async function getDeviceType(): Promise<DeviceType> {
  const { cookies, headers } = await import("next/headers");
  const jar = await cookies();
  const h = await headers();
  return resolveDeviceType({
    cookieDevice: jar.get(DEVICE_COOKIE)?.value,
    forceMobile: jar.get(FORCE_MOBILE_COOKIE)?.value === "1",
    userAgent: h.get("user-agent"),
  });
}

/**
 * Landing publique : priorise l’UA (évite un cookie desktop stale sur téléphone).
 * Override `?mobile=1` / cookie force toujours respecté.
 */
export async function getLandingDeviceType(): Promise<DeviceType> {
  const { cookies, headers } = await import("next/headers");
  const jar = await cookies();
  const h = await headers();
  if (jar.get(FORCE_MOBILE_COOKIE)?.value === "1") return "mobile";
  return isMobileUserAgent(h.get("user-agent")) ? "mobile" : "desktop";
}

export function isForceMobileCookie(
  value: string | undefined | null
): boolean {
  return value === "1";
}
