import type { DeviceType } from "@/lib/device";

/**
 * Feature flags produit par device — un seul endroit à ajuster.
 * Le shell lit ces flags ; éviter les `if (isMobile)` dispersés.
 */
export const FEATURES = {
  /** Sidebar multi-panel + topbar desktop */
  sidebarNav: { mobile: false, desktop: true },
  /** Bottom navigation */
  bottomNav: { mobile: true, desktop: false },
  /** Copilote docké à droite (widget) */
  copilotDocked: { mobile: false, desktop: true },
  /** Copilote mis en avant / plein espace */
  copilotFullscreen: { mobile: true, desktop: false },
  /** Layout multi-panel (sidebar + main + assistant) */
  multiPanel: { mobile: false, desktop: true },
  /** Import catalogue / fiches produit lourdes */
  catalogImport: { mobile: false, desktop: true },
  /** CTA upgrade Franchise dans la marque */
  upgradeCta: { mobile: false, desktop: true },
  /** Accueil desktop DashboardView vs MobileHome */
  desktopDashboard: { mobile: false, desktop: true },
  /** Tours / spotlight topbar (bruit sur mobile) */
  topbarSpotlight: { mobile: false, desktop: true },
  /** Landing complète multi-sections */
  desktopLanding: { mobile: false, desktop: true },
  /** Landing mobile minimale (brief) */
  mobileLanding: { mobile: true, desktop: false },
  /**
   * App mobile post-login à 3 onglets (Dashboard / Copilote / Réglages).
   * Pas de BottomNav multi-modules, pas de copilote docké — page /assistant.
   */
  mobileThreeTabApp: { mobile: true, desktop: false },
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function isFeatureEnabled(
  feature: FeatureKey,
  device: DeviceType
): boolean {
  return FEATURES[feature][device];
}
