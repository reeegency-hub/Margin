import { redirect } from "next/navigation";

/** Ancien écran « OK cuisine » → le cuisto corrige via Vérification. */
export default function CuisineRedirectPage() {
  redirect("/inventory");
}
