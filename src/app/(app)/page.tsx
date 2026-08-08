import { requireSession } from "@/lib/session";
import { getDashboardMetrics } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { buildHomeData } from "@/components/home/buildHomeData";
import { HomeAlertsGate } from "@/components/dashboard/HomeAlertsGate";
import { getFirstHourState } from "@/lib/first-hour";
import { getCostPilotSnapshot } from "@/lib/cost-engine";
import { buildDayWeekFocuses } from "@/lib/home-focus";
import { getDeviceType } from "@/lib/device";
import { isFeatureEnabled } from "@/config/features";

export default async function HomePage() {
  const session = await requireSession();
  const device = await getDeviceType();
  const m = await getDashboardMetrics(session.user.restaurantId);
  const rid = session.user.restaurantId;

  const [orders, firstHour, costPilot] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { restaurantId: rid, status: "TO_VALIDATE" },
      include: {
        supplier: true,
        lines: { include: { ingredient: true } },
      },
      take: 5,
    }),
    getFirstHourState(rid),
    getCostPilotSnapshot(rid),
  ]);

  const homeData = buildHomeData({
    restaurantName: session.user.restaurantName,
    caToday: m.caToday,
    caWeek: m.caWeek,
    caMonth: m.caMonth,
    caLast7Days: m.caLast7Days,
    topDishes: m.topDishes,
    critical: m.critical,
    ordersToValidate: orders,
    alertCount: m.alerts.length + m.critical.length,
    outageCount: m.openOutages.length,
  });

  const firstHourActive = Boolean(firstHour?.active);

  const focuses = buildDayWeekFocuses({
    costPilot,
    ordersToValidate: m.ordersToValidate,
    critical: m.critical,
    offlineKiosks: m.offlineKiosks.length,
    alert: homeData.alert,
  });

  const foodCostPcts = costPilot.topDishCosts
    .map((d) => d.foodCostPct)
    .filter((n): n is number => n != null);
  const avgFoodCostPct =
    foodCostPcts.length > 0
      ? foodCostPcts.reduce((a, b) => a + b, 0) / foodCostPcts.length
      : null;

  const costKpis = {
    hikesToday: costPilot.hikesToday.length,
    hikesWeek: costPilot.hikesWeek.length,
    lossEur: costPilot.weeklyLoss.lossEur,
    needsInventory: costPilot.weeklyLoss.needsInventory,
    avgFoodCostPct,
    pricedLineCount: costPilot.pricedLineCount,
    savingsPotential: costPilot.monthlySavingsPotential,
  };

  const dashboardAlerts = m.alerts.map((a) => ({
    id: a.id,
    title: a.title,
    constat: a.constat,
    cause: a.cause,
    impact: a.impact,
    action: a.action,
    severity: a.severity,
    type: a.type,
    ctaHref:
      a.type === "STOCK_CRITICAL"
        ? "/orders"
        : a.type === "PRICE_INCREASE"
          ? "/costs#hausses"
          : a.type?.includes("STAFF")
            ? "/employees"
            : undefined,
  }));

  // Un seul accueil chargé — pas de double bundle CSS-hidden
  if (!isFeatureEnabled("desktopDashboard", device)) {
    if (isFeatureEnabled("mobileThreeTabApp", device)) {
      const { CopilotScreen } = await import(
        "@/components/mobile/app/CopilotScreen"
      );
      return (
        <HomeAlertsGate
          alerts={dashboardAlerts}
          restaurantName={session.user.restaurantName}
          whatsappTo={m.restaurant.whatsappTo}
          suppressModal
        >
          <CopilotScreen
            restaurantName={session.user.restaurantName}
            userName={session.user.name}
          />
        </HomeAlertsGate>
      );
    }
    const { MobileHome } = await import("@/components/home/MobileHome");
    return (
      <HomeAlertsGate
        alerts={dashboardAlerts}
        restaurantName={session.user.restaurantName}
        whatsappTo={m.restaurant.whatsappTo}
        suppressModal={firstHourActive}
      >
        <MobileHome data={homeData} focuses={focuses} costKpis={costKpis} />
      </HomeAlertsGate>
    );
  }

  const { DashboardView } = await import(
    "@/components/dashboard/DashboardView"
  );
  return (
    <HomeAlertsGate
      alerts={dashboardAlerts}
      restaurantName={session.user.restaurantName}
      whatsappTo={m.restaurant.whatsappTo}
      suppressModal={firstHourActive}
    >
      <DashboardView
        restaurantName={session.user.restaurantName}
        whatsappTo={m.restaurant.whatsappTo}
        alerts={dashboardAlerts}
        caToday={m.caToday}
        caYesterday={m.caYesterday}
        caWeek={m.caWeek}
        caLastWeek={m.caLastWeek}
        caMonth={m.caMonth}
        caLastMonth={m.caLastMonth}
        caLast7Days={m.caLast7Days}
        topDishes={m.topDishes}
        ticketMoyen={m.ticketMoyen}
        ticketYesterday={m.ticketYesterday}
        salesTodayCount={m.salesTodayCount}
        ordersToValidate={m.ordersToValidate}
        offlineKiosks={m.offlineKiosks.length}
        openOutages={m.openOutages.length}
        purchaseOrders={orders}
        focuses={focuses}
        costKpis={costKpis}
      />
    </HomeAlertsGate>
  );
}
