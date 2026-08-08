"use client";

import { ChromeShell } from "@/components/shared/ChromeShell";
import type { AppShellProps } from "@/components/shared/shell-types";

/**
 * Shell mobile — copilote mis en avant, bottom nav, features réduites.
 * Bundle chargé uniquement quand le layout serveur choisit mobile.
 */
export function MobileShell(props: AppShellProps) {
  return <ChromeShell {...props} device="mobile" />;
}

export default MobileShell;
