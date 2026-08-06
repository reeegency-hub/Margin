import { formatQty } from "@/lib/stock-engine";
import type { HomeData, HomeAlert } from "@/components/home/types";

type BuildInput = {
  restaurantName: string;
  caToday: number;
  caWeek: number;
  caMonth: number;
  caLast7Days: { x: number; y: number; label: string }[];
  topDishes: { label: string; pct: number; qty: number }[];
  critical: {
    name: string;
    unit: string;
    stockTheoretical: number;
    reorderQty: number;
  }[];
  ordersToValidate: {
    id: string;
    totalAmount: number;
    lines: { quantity: number; ingredient: { name: string; unit: string } }[];
  }[];
  alertCount: number;
  outageCount: number;
};

export function buildHomeData(input: BuildInput): HomeData {
  let alert: HomeAlert = null;

  const critical = input.critical[0];
  const order = input.ordersToValidate[0];

  if (critical && order) {
    const qty =
      critical.reorderQty > 0
        ? formatQty(critical.reorderQty, critical.unit, critical.name)
        : formatQty(
            order.lines[0]?.quantity ?? 0,
            critical.unit,
            critical.name
          );
    alert = {
      id: order.id,
      badgeLabel:
        input.alertCount > 1
          ? `${input.alertCount} actions urgentes`
          : "1 action urgente",
      message: `Stock de ${critical.name.toLowerCase()} bas. À racheter : ${qty}.`,
      ctaLabel: "Voir la liste",
      orderId: order.id,
    };
  } else if (critical) {
    const qty = formatQty(critical.reorderQty || 0, critical.unit, critical.name);
    alert = {
      id: "critical",
      badgeLabel: "1 action urgente",
      message: `Stock de ${critical.name.toLowerCase()} bas. À racheter : ${qty}.`,
      ctaLabel: "Ouvrir Courses",
      ctaHref: "/orders",
    };
  } else if (order) {
    const line = order.lines[0];
    alert = {
      id: order.id,
      badgeLabel: "1 action urgente",
      message: line
        ? `Liste prête : ${formatQty(line.quantity, line.ingredient.unit, line.ingredient.name)} ${line.ingredient.name.toLowerCase()}.`
        : "Une liste de courses attend d’être faite.",
      ctaLabel: "Ouvrir Courses",
      orderId: order.id,
    };
  } else if (input.outageCount > 0) {
    alert = {
      id: "outage",
      badgeLabel: "1 action urgente",
      message:
        "Une plateforme de livraison est coupée. Remettez-la en ligne pour ne pas perdre de commandes.",
      ctaLabel: "Remettre en ligne",
      ctaHref: "/delivery",
    };
  }

  return {
    restaurantName: input.restaurantName,
    caToday: input.caToday,
    caWeek: input.caWeek,
    caMonth: input.caMonth,
    caLast7Days: input.caLast7Days,
    topDishes: input.topDishes,
    hasNotifications: Boolean(alert) || input.alertCount > 0,
    alert,
  };
}
