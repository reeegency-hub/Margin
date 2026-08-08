"use client";

import { ChromeShell } from "@/components/shared/ChromeShell";
import type { AppShellProps } from "@/components/shared/shell-types";
import { isFeatureEnabled } from "@/config/features";
import { MobileNavTabs } from "@/components/mobile/app/MobileNavTabs";

export function MobileShell(props: AppShellProps) {
  const threeTab = isFeatureEnabled("mobileThreeTabApp", "mobile");
  return (
    <>
      <ChromeShell {...props} device="mobile" />
      {threeTab ? <MobileNavTabs /> : null}
    </>
  );
}
