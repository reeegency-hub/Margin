/**
 * @deprecated Le layout (app) charge MobileShell ou DesktopShell via import dynamique.
 * Conservé pour imports hors layout — défaut desktop.
 */
"use client";

import { DesktopShell } from "@/components/desktop/DesktopShell";
import { MobileShell } from "@/components/mobile/MobileShell";
import type { AppShellProps } from "@/components/shared/shell-types";

export function AppChrome({
  forceMobile = false,
  ...props
}: AppShellProps & { forceMobile?: boolean }) {
  if (forceMobile) {
    return <MobileShell {...props} forceMobileOverride />;
  }
  return <DesktopShell {...props} />;
}
