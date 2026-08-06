"use client";

import type { ReactNode } from "react";
import type { DashboardAlert } from "@/components/dashboard/dashboard-alert";
import { AlertsNowModal } from "@/components/dashboard/AlertsNowModal";
import { HomeAlertsProvider } from "@/components/dashboard/HomeAlertsContext";

/** Un seul popup alertes Accueil (évite double mount mobile + desktop). */
export function HomeAlertsGate({
  alerts,
  restaurantName,
  whatsappTo,
  suppressModal = false,
  children,
}: {
  alerts: DashboardAlert[];
  restaurantName: string;
  whatsappTo: string | null;
  /** Pendant la Première heure : pas de popup en plus de la checklist */
  suppressModal?: boolean;
  children: ReactNode;
}) {
  return (
    <HomeAlertsProvider>
      {!suppressModal ? (
      <AlertsNowModal
        alerts={alerts}
        restaurantName={restaurantName}
        whatsappTo={whatsappTo}
      />
      ) : null}
      {children}
    </HomeAlertsProvider>
  );
}
