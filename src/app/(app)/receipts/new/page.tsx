import { redirect } from "next/navigation";

/** Orphelin MVP — le réassort se gère via Courses + Vérification. */
export default function NewReceiptPage() {
  redirect("/orders");
}
