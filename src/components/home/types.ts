export type HomeAlert = {
  id: string;
  badgeLabel: string;
  message: string;
  ctaLabel: string;
  ctaHref?: string;
  orderId?: string;
} | null;

export type HomeData = {
  restaurantName: string;
  caToday: number;
  caWeek: number;
  caMonth: number;
  caLast7Days: { x: number; y: number; label: string }[];
  topDishes: { label: string; pct: number; qty: number }[];
  hasNotifications: boolean;
  alert: HomeAlert;
};
