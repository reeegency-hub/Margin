import { redirect } from "next/navigation";

/** Ancienne URL — la saisie manuelle est sur /sales. */
export default function NewSalePage() {
  redirect("/sales");
}
