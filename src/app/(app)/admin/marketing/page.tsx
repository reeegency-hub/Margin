import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin";
import { MarketingHub } from "@/components/admin/MarketingHub";
import { FounderSubnav } from "@/components/admin/FounderSubnav";

export default async function AdminMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminSession();
  if (!session) redirect("/login?error=admin");

  const params = await searchParams;
  const initialTab =
    params.tab === "influencers" || params.tab === "playbook"
      ? params.tab
      : params.tab === "cold"
        ? "cold"
        : "playbook";

  const [prospects, influencers] = await Promise.all([
    prisma.marketingProspect.findMany({
      orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.marketingInfluencer.findMany({
      orderBy: [{ fitScore: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);

  const now = Date.now();
  const dueCount = prospects.filter(
    (p) =>
      p.nextFollowUpAt &&
      p.nextFollowUpAt.getTime() <= now &&
      !["won", "lost", "paused"].includes(p.status)
  ).length;

  return (
    <div className="admin-page founder-page mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="brand-eyebrow">Margin · Fondateur</p>
          <h1 className="module-page-title">Marketing &amp; acquisition</h1>
          <p className="module-page-lead">
            Playbook · cold email 3 touches · micro-influenceurs — envoi manuel
            (copier / mailto) — {session.user.email}
          </p>
        </div>
        <Link href="/" className="btn-ghost">
          Retour app
        </Link>
      </header>

      <FounderSubnav current="/admin/marketing" />

      <div className="founder-kpis">
        <div className="founder-kpi">
          <p className="founder-kpi__label">Prospects</p>
          <p className="founder-kpi__value">{prospects.length}</p>
        </div>
        <div className="founder-kpi">
          <p className="founder-kpi__label">Relances dues</p>
          <p className="founder-kpi__value">{dueCount}</p>
        </div>
        <div className="founder-kpi">
          <p className="founder-kpi__label">Créateurs</p>
          <p className="founder-kpi__value">{influencers.length}</p>
        </div>
        <div className="founder-kpi">
          <p className="founder-kpi__label">Fit ≥ 70</p>
          <p className="founder-kpi__value">
            {influencers.filter((i) => i.fitScore >= 70).length}
          </p>
        </div>
      </div>

      <MarketingHub
        initialTab={initialTab}
        dueCount={dueCount}
        prospects={prospects.map((p) => ({
          id: p.id,
          email: p.email,
          contactName: p.contactName,
          businessName: p.businessName,
          city: p.city,
          segment: p.segment,
          posVendor: p.posVendor,
          status: p.status,
          sequenceStep: p.sequenceStep,
          lastContactedAt: p.lastContactedAt?.toISOString() ?? null,
          nextFollowUpAt: p.nextFollowUpAt?.toISOString() ?? null,
          notes: p.notes,
        }))}
        influencers={influencers.map((i) => ({
          id: i.id,
          handle: i.handle,
          displayName: i.displayName,
          platform: i.platform,
          profileUrl: i.profileUrl,
          email: i.email,
          city: i.city,
          niche: i.niche,
          followers: i.followers,
          engagementPct: i.engagementPct,
          fitScore: i.fitScore,
          status: i.status,
          dealType: i.dealType,
          notes: i.notes,
          lastContactedAt: i.lastContactedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
