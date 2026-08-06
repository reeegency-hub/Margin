export type DashboardAlert = {
  id: string;
  title: string;
  constat: string;
  cause?: string | null;
  impact: string;
  action: string;
  severity: number;
  type?: string;
  ctaHref?: string;
};
