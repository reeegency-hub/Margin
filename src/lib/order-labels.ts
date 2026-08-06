/** Statuts liste de courses (DB = ENUM purchase order). */
export function orderStatusLabel(status: string): string {
  switch (status) {
    case "TO_VALIDATE":
      return "À faire";
    case "VALIDATED":
    case "SENT":
      return "Fait";
    case "RECEIVED":
      return "Réceptionné";
    case "CANCELLED":
      return "Annulé";
    case "DRAFT":
      return "Brouillon";
    default:
      return status;
  }
}
