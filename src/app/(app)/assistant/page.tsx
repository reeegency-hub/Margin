import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

/** Ancien onglet Copilote → accueil (LLM). */
export default async function AssistantPage() {
  await requireSession();
  redirect("/");
}
