/** Libellé affiché pour un rôle technique (codes DB inchangés). */
export const ROLE_LABEL: Record<string, string> = {
  salle: "caisse",
  cuisine: "rayon",
  livreur: "livreur",
};

/** Salaire horaire par défaut selon le poste (€/h). */
export const DEFAULT_HOURLY_RATES: Record<string, number> = {
  salle: 12,
  cuisine: 13,
  livreur: 12.5,
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] || role;
}

export function defaultHourlyRate(role: string): number {
  return DEFAULT_HOURLY_RATES[role] ?? 12;
}
