/**
 * Canal de support pilote — un seul canal pour ne pas disperser le suivi.
 * Soft-launch : email fondateur (domaine custom pas encore vérifié).
 */
export const SUPPORT = {
  channel: "email" as const,
  email: "reeegency@gmail.com",
  label: "Support Margin",
  subject: "Aide pilote Margin",
} as const;

export function supportMailto(subject: string = SUPPORT.subject): string {
  return `mailto:${SUPPORT.email}?subject=${encodeURIComponent(subject)}`;
}
