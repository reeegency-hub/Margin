import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppChrome } from "@/components/AppChrome";
import { StockAlertService } from "@/lib/stock-alert-service";
import type { StockAlertSummary } from "@/lib/stock-alert-service";
import { isAdminEmail } from "@/lib/admin";
import { PLANS } from "@/lib/plans";
import { hasAppAccess } from "@/lib/stripe/access";
import { getFirstHourState } from "@/lib/first-hour";
import { getCostPilotSnapshot } from "@/lib/cost-engine";
import type { CostPilotSnapshot } from "@/lib/cost-engine";

/** Next.js redirect() throws — must not be swallowed by try/catch. */
function rethrowRedirect(err: unknown): void {
  if (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  ) {
    throw err;
  }
}

function resolvePlanLabel(plan: string | null | undefined): string {
  if (!plan) return "Commerce";
  return (
    PLANS.find((p) => p.id === plan)?.name ||
    (plan === "boutique" ? "Boutique" : "Commerce")
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.restaurantId) {
    redirect("/login?error=session");
  }

  let restaurant: {
    onboardingCompletedAt: Date | null;
    whatsappTo: string | null;
    plan: string | null;
    active: boolean;
    stripeStatus: string | null;
    accessGraceUntil: Date | null;
    paymentFailedAt: Date | null;
  } | null = null;

  try {
    restaurant = await prisma.restaurant.findUnique({
      where: { id: session.user.restaurantId },
      select: {
        onboardingCompletedAt: true,
        whatsappTo: true,
        plan: true,
        active: true,
        stripeStatus: true,
        accessGraceUntil: true,
        paymentFailedAt: true,
      },
    });
  } catch (err) {
    rethrowRedirect(err);
    console.error("[app/layout] restaurant lookup failed", err);
    redirect("/login?error=session");
  }

  if (!restaurant) {
    redirect("/login?error=session");
  }

  if (!hasAppAccess(restaurant) && !isAdminEmail(session.user.email)) {
    redirect("/login?error=billing");
  }

  if (
    !restaurant.onboardingCompletedAt &&
    !isAdminEmail(session.user.email)
  ) {
    redirect("/onboarding");
  }

  const planLabel = resolvePlanLabel(restaurant.plan);

  let pendingStockRecap: StockAlertSummary | null = null;
  try {
    const pending = await StockAlertService.getPending(
      session.user.restaurantId
    );
    pendingStockRecap = pending?.summary ?? null;
  } catch (err) {
    rethrowRedirect(err);
    console.error("[app/layout] stock recap lookup failed", err);
  }

  const jar = await cookies();
  const forceMobile = jar.get("margin_mobile")?.value === "1";

  let firstHour: Awaited<ReturnType<typeof getFirstHourState>> = null;
  let costPilot: CostPilotSnapshot | null = null;
  try {
    const [fh, costs] = await Promise.all([
      getFirstHourState(session.user.restaurantId),
      getCostPilotSnapshot(session.user.restaurantId),
    ]);
    firstHour = fh;
    costPilot = costs;
  } catch (err) {
    rethrowRedirect(err);
    console.error("[app/layout] first-hour / costs failed", err);
  }

  return (
    <AppChrome
      restaurantName={session.user.restaurantName}
      planLabel={planLabel}
      whatsappTo={restaurant.whatsappTo}
      pendingStockRecap={pendingStockRecap}
      forceMobile={forceMobile}
      isAdmin={isAdminEmail(session.user.email)}
      firstHour={firstHour}
    >
      {children}
    </AppChrome>
  );
}
