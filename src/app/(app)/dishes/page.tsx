import { redirect } from "next/navigation";

/** Ancienne page Produits → onglet Catalogue du Stock. */
export default function DishesRedirectPage() {
  redirect("/ingredients?tab=catalogue");
}
