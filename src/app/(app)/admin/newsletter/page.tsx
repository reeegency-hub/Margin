import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin";
import { FounderSubnav } from "@/components/admin/FounderSubnav";

export default async function AdminNewsletterPage() {
  const session = await requireAdminSession();
  if (!session) redirect("/login?error=admin");

  const [active, unsubscribed, recent] = await Promise.all([
    prisma.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    prisma.newsletterSubscriber.count({
      where: { unsubscribedAt: { not: null } },
    }),
    prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        email: true,
        name: true,
        source: true,
        consentedAt: true,
        unsubscribedAt: true,
        welcomeSentAt: true,
        restaurantId: true,
      },
    }),
  ]);

  const csvRows = [
    "email,name,source,consentedAt,unsubscribedAt,welcomeSentAt",
    ...recent
      .filter((r) => !r.unsubscribedAt)
      .map((r) =>
        [
          r.email,
          JSON.stringify(r.name || ""),
          r.source,
          r.consentedAt.toISOString(),
          "",
          r.welcomeSentAt?.toISOString() || "",
        ].join(",")
      ),
  ].join("\n");

  return (
    <div className="admin-page founder-page mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="brand-eyebrow">Margin · Fondateur</p>
          <h1 className="module-page-title">Newsletter</h1>
          <p className="module-page-lead">
            {active} actifs · {unsubscribed} désinscrits — {session.user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            className="btn-lime btn-lime--sm"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvRows)}`}
            download={`margin-newsletter-${new Date().toISOString().slice(0, 10)}.csv`}
          >
            Export CSV (actifs)
          </a>
          <Link href="/" className="btn-ghost">
            Retour app
          </Link>
        </div>
      </header>

      <FounderSubnav current="/admin/newsletter" />

      <div className="dash-card dash-card--light overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-black/10 text-[11px] uppercase opacity-60">
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Source</th>
              <th className="py-2 pr-3">Inscription</th>
              <th className="py-2 pr-3">Welcome</th>
              <th className="py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} className="border-b border-black/5">
                <td className="py-2 pr-3 font-medium">
                  {r.email}
                  {r.name ? (
                    <span className="ml-1 opacity-50">({r.name})</span>
                  ) : null}
                </td>
                <td className="py-2 pr-3">{r.source}</td>
                <td className="py-2 pr-3">
                  {r.consentedAt.toLocaleDateString("fr-FR")}
                </td>
                <td className="py-2 pr-3">
                  {r.welcomeSentAt
                    ? r.welcomeSentAt.toLocaleDateString("fr-FR")
                    : "—"}
                </td>
                <td className="py-2">
                  {r.unsubscribedAt ? (
                    <span className="text-red-700">Désinscrit</span>
                  ) : (
                    <span className="text-emerald-700">Actif</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recent.length === 0 ? (
          <p className="py-6 text-center opacity-60">
            Aucun abonné pour l’instant.
          </p>
        ) : null}
      </div>
    </div>
  );
}
