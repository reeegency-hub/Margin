import { redirect } from "next/navigation";
import { requireAmbassador } from "@/lib/partner-auth";
import { prisma } from "@/lib/db";
import { updateProspectStatusAction } from "../../actions";

export default async function PartnerAgendaPage() {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const now = new Date();
  const prospects = await prisma.prospect.findMany({
    where: {
      ambassadorId: me.id,
      nextFollowUpAt: { not: null },
      status: { notIn: ["won", "lost"] },
    },
    orderBy: { nextFollowUpAt: "asc" },
  });

  const overdue = prospects.filter(
    (p) => p.nextFollowUpAt && p.nextFollowUpAt < now
  );
  const upcoming = prospects.filter(
    (p) => p.nextFollowUpAt && p.nextFollowUpAt >= now
  );

  return (
    <main className="partner__main">
      <header className="partner-page-head">
        <p className="brand-eyebrow">Relances</p>
        <h1>
          Votre <em>agenda</em>
        </h1>
        <p className="partner-muted partner-page-head__lead">
          <strong>{overdue.length}</strong> en retard ·{" "}
          <strong>{upcoming.length}</strong> à venir
        </p>
      </header>

      <div className="partner-panel-grid">
        <section className="partner-card">
          <h2>En retard</h2>
          {!overdue.length ? (
            <p className="partner-muted">Rien en retard.</p>
          ) : (
            overdue.map((p) => <AgendaRow key={p.id} prospect={p} overdue />)
          )}
        </section>

        <section className="partner-card">
          <h2>À venir</h2>
          {!upcoming.length ? (
            <p className="partner-muted">Aucune relance planifiée.</p>
          ) : (
            upcoming.map((p) => <AgendaRow key={p.id} prospect={p} />)
          )}
        </section>
      </div>
    </main>
  );
}

function AgendaRow({
  prospect: p,
  overdue,
}: {
  prospect: {
    id: string;
    businessName: string;
    contactName: string;
    nextFollowUpAt: Date | null;
    status: string;
  };
  overdue?: boolean;
}) {
  const when = p.nextFollowUpAt
    ? p.nextFollowUpAt.toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="partner-row">
      <div>
        <strong className="partner-row__title">{p.businessName}</strong>
        <p className={`partner-muted${overdue ? " partner-overdue" : ""}`}>
          {p.contactName} · {when}
        </p>
      </div>
      <form action={updateProspectStatusAction}>
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="status" value="contacted" />
        <button type="submit" className="partner-btn partner-btn--sm">
          Fait
        </button>
      </form>
    </div>
  );
}
