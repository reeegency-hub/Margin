import { prisma } from "@/lib/db";
import { absoluteAmbassadorSignupUrl } from "@/lib/ambassador-referral";

export type AmbassadorDashboardRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  referralCode: string | null;
  signupUrl: string | null;
  createdAt: Date;
  prospectCount: number;
  prospectsOpen: number;
  storeCount: number;
  activeStores: number;
  commissionCents: number;
  stores: {
    id: string;
    name: string;
    email: string | null;
    stripeStatus: string | null;
    active: boolean;
    productCount: number;
    lastInvoiceAmountCents: number | null;
    commissionPercent: number;
    commissionCents: number;
  }[];
};

export async function getFounderAmbassadorDashboard(): Promise<{
  ambassadors: AmbassadorDashboardRow[];
  totals: {
    ambassadors: number;
    activeAmbassadors: number;
    stores: number;
    activeStores: number;
    prospects: number;
    commissionCents: number;
  };
}> {
  const ambassadors = await prisma.ambassador.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      prospects: { select: { status: true } },
      referrals: {
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              stripeStatus: true,
              active: true,
              lastInvoiceAmountCents: true,
              users: { orderBy: { createdAt: "asc" }, take: 1, select: { email: true } },
              _count: { select: { products: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const rows: AmbassadorDashboardRow[] = ambassadors.map((a) => {
    let commissionCents = 0;
    let activeStores = 0;
    const stores = a.referrals.map((r) => {
      const amt = r.restaurant.lastInvoiceAmountCents ?? 0;
      const storeCommission =
        amt > 0 ? Math.round((amt * r.commissionPercent) / 100) : 0;
      commissionCents += storeCommission;
      if (r.restaurant.active && r.restaurant.stripeStatus === "active") {
        activeStores += 1;
      }
      return {
        id: r.restaurant.id,
        name: r.restaurant.name,
        email: r.restaurant.users[0]?.email ?? null,
        stripeStatus: r.restaurant.stripeStatus,
        active: r.restaurant.active,
        productCount: r.restaurant._count.products,
        lastInvoiceAmountCents: r.restaurant.lastInvoiceAmountCents,
        commissionPercent: r.commissionPercent,
        commissionCents: storeCommission,
      };
    });

    const prospectsOpen = a.prospects.filter(
      (p) => !["won", "lost"].includes(p.status)
    ).length;

    return {
      id: a.id,
      name: a.name,
      email: a.email,
      active: a.active,
      referralCode: a.referralCode,
      signupUrl: a.referralCode
        ? absoluteAmbassadorSignupUrl(a.referralCode)
        : null,
      createdAt: a.createdAt,
      prospectCount: a.prospects.length,
      prospectsOpen,
      storeCount: stores.length,
      activeStores,
      commissionCents,
      stores,
    };
  });

  return {
    ambassadors: rows,
    totals: {
      ambassadors: rows.length,
      activeAmbassadors: rows.filter((a) => a.active).length,
      stores: rows.reduce((n, a) => n + a.storeCount, 0),
      activeStores: rows.reduce((n, a) => n + a.activeStores, 0),
      prospects: rows.reduce((n, a) => n + a.prospectCount, 0),
      commissionCents: rows.reduce((n, a) => n + a.commissionCents, 0),
    },
  };
}
