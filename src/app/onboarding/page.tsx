import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOpenAIConfig } from "@/lib/openai";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.restaurantId) {
    redirect("/login?error=session");
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.user.restaurantId },
  });

  if (!restaurant) {
    redirect("/login?error=session");
  }

  if (restaurant.onboardingCompletedAt) {
    redirect("/");
  }

  const [dishCount, openai] = await Promise.all([
    prisma.product.count({
      where: { restaurantId: restaurant.id, active: true },
    }),
    getOpenAIConfig(restaurant.id),
  ]);

  let platforms: string[] = [];
  try {
    platforms = restaurant.onboardingPlatforms
      ? (JSON.parse(restaurant.onboardingPlatforms) as string[])
      : [];
  } catch {
    platforms = [];
  }

  const procurementMode = ["suppliers_deliver", "self_shop", "mixed"].includes(
      restaurant.procurementMode || ""
    )
      ? restaurant.procurementMode
    : null;

  return (
    <OnboardingWizard
        initial={{
          restaurantName: restaurant.name,
          staffSalle: restaurant.staffSalle,
          staffCuisine: restaurant.staffCuisine,
          staffLivreur: restaurant.staffLivreur,
          platforms,
          procurementMode,
          whatsappTo: restaurant.whatsappTo || "",
          dishCount,
          openaiConfigured: openai.configured,
          plan: (["boutique", "commerce", "reseau"].includes(
            restaurant.plan || ""
          )
            ? restaurant.plan
            : null) as import("@/lib/plans").PlanId | null,
          billingPeriod: (["monthly", "yearly"].includes(
            restaurant.billingPeriod || ""
          )
            ? restaurant.billingPeriod
            : null) as import("@/lib/plans").BillingPeriod | null,
        }}
      />
  );
}
