import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  eachDayOfInterval,
  format,
} from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/db";

export type CaDayPoint = { x: number; y: number; label: string };

export type TopDishBar = { label: string; pct: number; qty: number };

export async function getDashboardMetrics(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
  });

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const yesterdayStart = startOfDay(subDays(now, 1));
  const yesterdayEnd = endOfDay(subDays(now, 1));
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const chartStart = startOfDay(subDays(now, 6));

  const [
    salesToday,
    salesYesterday,
    salesWeek,
    salesLastWeek,
    salesMonth,
    salesLastMonth,
    salesChart,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: {
        restaurantId,
        soldAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.sale.findMany({
      where: {
        restaurantId,
        soldAt: { gte: yesterdayStart, lte: yesterdayEnd },
      },
    }),
    prisma.sale.findMany({
      where: {
        restaurantId,
        soldAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    prisma.sale.findMany({
      where: {
        restaurantId,
        soldAt: { gte: lastWeekStart, lte: lastWeekEnd },
      },
    }),
    prisma.sale.findMany({
      where: {
        restaurantId,
        soldAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.sale.findMany({
      where: {
        restaurantId,
        soldAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
    }),
    prisma.sale.findMany({
      where: {
        restaurantId,
        soldAt: { gte: chartStart, lte: todayEnd },
      },
      select: { soldAt: true, totalAmount: true },
    }),
  ]);

  const sum = (sales: { totalAmount: number }[]) =>
    sales.reduce((s, x) => s + x.totalAmount, 0);

  const caToday = sum(salesToday);
  const caYesterday = sum(salesYesterday);
  const caWeek = sum(salesWeek);
  const caLastWeek = sum(salesLastWeek);
  const caMonth = sum(salesMonth);
  const caLastMonth = sum(salesLastMonth);
  const ticketMoyen =
    salesToday.length > 0 ? caToday / salesToday.length : 0;
  const ticketYesterday =
    salesYesterday.length > 0 ? caYesterday / salesYesterday.length : 0;

  const days = eachDayOfInterval({ start: chartStart, end: todayStart });
  const byDay = new Map<string, number>();
  for (const s of salesChart) {
    const key = format(startOfDay(s.soldAt), "yyyy-MM-dd");
    byDay.set(key, (byDay.get(key) ?? 0) + s.totalAmount);
  }
  const caLast7Days: CaDayPoint[] = days.map((d, i) => ({
    x: i,
    y: Math.round(byDay.get(format(d, "yyyy-MM-dd")) ?? 0),
    label: format(d, "EEEEE", { locale: fr }).toUpperCase(),
  }));

  const weekSaleIds = salesWeek.map((s) => s.id);
  const topItems =
    weekSaleIds.length === 0
      ? []
      : await prisma.saleItem.groupBy({
          by: ["dishId"],
          where: { saleId: { in: weekSaleIds } },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 5,
        });
  const dishIds = topItems.map((t) => t.dishId);
  const dishes =
    dishIds.length === 0
      ? []
      : await prisma.dish.findMany({
          where: { id: { in: dishIds }, restaurantId },
          select: { id: true, name: true },
        });
  const dishName = new Map(dishes.map((d) => [d.id, d.name]));
  const topQty = topItems.map((t) => t._sum.quantity ?? 0);
  const maxQty = Math.max(1, ...topQty);
  const topDishes: TopDishBar[] = topItems.map((t) => ({
    label: dishName.get(t.dishId) ?? "Plat",
    qty: t._sum.quantity ?? 0,
    pct: Math.round(((t._sum.quantity ?? 0) / maxQty) * 100),
  }));

  const criticalIngredients = await prisma.ingredient.findMany({
    where: { restaurantId },
    orderBy: { stockTheoretical: "asc" },
  });
  const critical = criticalIngredients.filter(
    (i) =>
      i.criticalThreshold > 0 && i.stockTheoretical <= i.criticalThreshold
  );

  const alerts = await prisma.alert.findMany({
    where: { restaurantId, status: "ACTIVE" },
    include: { ingredient: true },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
  });

  const [ordersToValidate, offlineKiosks, openOutages] = await Promise.all([
    prisma.purchaseOrder.count({
      where: { restaurantId, status: "TO_VALIDATE" },
    }),
    prisma.kiosk.findMany({
      where: { restaurantId, status: { not: "ONLINE" } },
    }),
    prisma.platformOutage.findMany({
      where: { restaurantId, endedAt: null },
    }),
  ]);

  return {
    restaurant,
    caToday,
    caYesterday,
    caWeek,
    caLastWeek,
    caMonth,
    caLastMonth,
    caLast7Days,
    topDishes,
    ticketMoyen,
    ticketYesterday,
    salesTodayCount: salesToday.length,
    critical,
    alerts,
    ordersToValidate,
    offlineKiosks,
    openOutages,
  };
}

export function euro(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export function pctDelta(current: number, previous: number): string | null {
  if (previous === 0) return current === 0 ? null : null;
  const d = ((current - previous) / previous) * 100;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(0)} %`;
}
