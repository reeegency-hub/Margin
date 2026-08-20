/**
 * Secrets runtime — refuse les fallbacks *-dev en production.
 */

export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

/** Pepper OTP : NEXTAUTH_SECRET (ou CREDENTIALS_ENCRYPTION_KEY). */
export function requireOtpPepper(): string {
  const value =
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.CREDENTIALS_ENCRYPTION_KEY?.trim() ||
    "";
  if (value) return value;
  if (isProductionRuntime()) {
    throw new Error(
      "[security] NEXTAUTH_SECRET (ou CREDENTIALS_ENCRYPTION_KEY) requis pour OTP en production."
    );
  }
  return "margin-otp-dev";
}

/** Secret cookie partenaire : PARTNER_AUTH_SECRET → NEXTAUTH_SECRET. */
export function requirePartnerAuthSecret(): string {
  const value =
    process.env.PARTNER_AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "";
  if (value) return value;
  if (isProductionRuntime()) {
    throw new Error(
      "[security] PARTNER_AUTH_SECRET (ou NEXTAUTH_SECRET) requis en production."
    );
  }
  return "margin-partner-dev";
}
