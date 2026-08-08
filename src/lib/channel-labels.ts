/** Libellés canaux / plateformes — safe client (pas de Prisma / Twilio). */

export const CHANNEL_LABELS: Record<string, string> = {
  dine_in: "Sur place",
  takeaway: "À emporter",
  kiosk: "Caisse",
  deliveroo: "Deliveroo",
  uber_eats: "Uber Eats",
  just_eat: "Just Eat",
  other: "Autre",
};

/** Statuts techniques plateforme → libellés FR pour l’UI */
export function platformStatusLabel(status: string): string {
  switch (status) {
    case "CONNECTED":
      return "Connectée";
    case "DISCONNECTED":
      return "Déconnectée";
    case "OUTAGE":
      return "Coupure";
    case "KEY_STORED":
      return "Clé enregistrée";
    case "WEBHOOK_LIVE":
      return "Webhook actif";
    default:
      return status;
  }
}

export function deliveryOrderStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "En attente";
    case "ASSIGNED":
      return "Assignée";
    case "PICKED_UP":
      return "Récupérée";
    case "DELIVERED":
      return "Livrée";
    case "CANCELLED":
      return "Annulée";
    default:
      return status;
  }
}
