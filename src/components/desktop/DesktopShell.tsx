"use client";

import { ChromeShell } from "@/components/shared/ChromeShell";
import type { AppShellProps } from "@/components/shared/shell-types";

/**
 * Shell desktop — sidebar, multi-panel, copilote docké.
 * Bundle chargé uniquement quand le layout serveur choisit desktop.
 */
export function DesktopShell(props: AppShellProps) {
  return <ChromeShell {...props} device="desktop" />;
}

export default DesktopShell;
