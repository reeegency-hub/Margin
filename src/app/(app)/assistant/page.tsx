import { requireSession } from "@/lib/session";
import { getDeviceType } from "@/lib/device";
import { isFeatureEnabled } from "@/config/features";
import { redirect } from "next/navigation";

/** /assistant → accueil (le LLM est la home mobile). */
export default async function AssistantPage() {
  await requireSession();
  const device = await getDeviceType();
  if (isFeatureEnabled("mobileThreeTabApp", device)) {
    redirect("/");
  }
  redirect("/");
}
