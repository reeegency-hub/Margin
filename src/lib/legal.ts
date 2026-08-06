/**
 * Identité légale Margin — à compléter avant go-live facturation.
 * Remplacez les champs `null` par les infos société réelles.
 */
export const LEGAL = {
  tradeName: "Margin",
  domain: "marginshop.app",
  email: "contact@marginshop.app",
  /** Raison sociale */
  companyName: null as string | null,
  legalForm: null as string | null,
  capital: null as string | null,
  address: null as string | null,
  siret: null as string | null,
  rcs: null as string | null,
  publicationDirector: null as string | null,
  /** Hébergeur applicatif (prod typique) */
  host: {
    name: "Vercel Inc.",
    address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    website: "https://vercel.com",
  },
} as const;

export function legalOrPlaceholder(value: string | null, label: string): string {
  return value?.trim() || `À compléter — ${label}`;
}
