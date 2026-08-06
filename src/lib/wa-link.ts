/** Normalize FR numbers (06… / 01…) to international digits for wa.me */
export function normalizeWaDigits(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // French national format → E.164 without +
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `33${digits.slice(1)}`;
  }
  if (digits.length < 8) return null;
  return digits;
}

/** Build wa.me link for dashboard send buttons */
export function buildWaMeLink(
  phone: string | null | undefined,
  message: string
): string | null {
  if (!phone) return null;
  const digits = normalizeWaDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function alertWaMessage(
  restaurantName: string,
  alert: {
    title: string;
    constat: string;
    action: string;
    impact?: string | null;
  }
): string {
  // Un message par alerte (jamais le récap rupture groupé).
  const lines = [`${restaurantName} — ${alert.title}`, alert.constat];
  if (alert.impact?.trim()) lines.push(alert.impact.trim());
  lines.push(`→ ${alert.action}`);
  return lines.join("\n");
}

export function shoppingListWaMessage(
  restaurantName: string,
  items: { name: string; quantityLabel: string }[]
): string {
  const lines = items.map((i) => `• ${i.name} — ${i.quantityLabel}`).join("\n");
  return `${restaurantName} — Liste de courses\n${lines}\n→ Réapprovisionnement à faire soi-même`;
}

export function supplierOrderWaMessage(
  restaurantName: string,
  supplierName: string,
  items: { name: string; quantityLabel: string }[]
): string {
  const lines = items.map((i) => `• ${i.name} — ${i.quantityLabel}`).join("\n");
  return `Bonjour ${supplierName},\nCommande ${restaurantName} :\n${lines}\n→ Merci de confirmer disponibilité et livraison.`;
}
