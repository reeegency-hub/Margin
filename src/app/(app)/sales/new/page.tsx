import { redirect } from "next/navigation";

/** Orphelin MVP — la vente passe par la caisse / webhook. */
export default function NewSalePage() {
  redirect("/kiosks");
}
