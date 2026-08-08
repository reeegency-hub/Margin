import { requireSession } from "@/lib/session";
import { getDeviceType } from "@/lib/device";
import { isFeatureEnabled } from "@/config/features";
import { redirect } from "next/navigation";

export default async function AssistantPage() {
  await requireSession();
  const device = await getDeviceType();
  if (!isFeatureEnabled("mobileThreeTabApp", device)) {
    redirect("/");
  }
  const { CopilotScreen } = await import(
    "@/components/mobile/app/CopilotScreen"
  );
  return <CopilotScreen />;
}
