import type { ReactNode } from "react";
import type { StockAlertSummary } from "@/lib/stock-alert-service";
import type { FirstHourState } from "@/lib/first-hour";
import type { DeviceType } from "@/lib/device";

export type AppShellProps = {
  restaurantName: string;
  restaurantId?: string;
  planLabel: string;
  plan?: string | null;
  whatsappTo: string | null;
  pendingStockRecap: StockAlertSummary | null;
  isAdmin?: boolean;
  firstHour?: FirstHourState | null;
  /** Override manuel ?mobile=1 — barre « Mode téléphone » */
  forceMobileOverride?: boolean;
  children: ReactNode;
};

export type DeviceShellProps = AppShellProps & {
  device: DeviceType;
};
