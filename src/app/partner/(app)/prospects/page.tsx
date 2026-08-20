import { redirect } from "next/navigation";
import { requireAmbassador } from "@/lib/partner-auth";
import { prisma } from "@/lib/db";
import {
  createProspectAction,
  deleteProspectAction,
  updateProspectStatusAction,
} from "../../actions";

const STATUS_LABEL: Record<string, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  follow_up: "Relance",
  won: "Gagné",
  lost: "Perdu",
};

export default async function PartnerProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");
  const params = await searchParams;

  const prospects = await prisma.prospect.findMany({
    where: { ambassadorId: me.id },
    orderBy: [{ updatedAt: "desc" }],
  });

  return (
    <main className="partner__main">
      {params.ok ? <p className="flash">Prospect ajouté.</p> : null}
      {params.error ? (
        <p className="flash flash-warn">Vérifiez les champs obligatoires.</p>
      ) : null}

      <header className="partner-page-head">
        <p className="brand-eyebrow">Pipeline</p>
        <h1>
          Vos <em>prospects</em>
        </h1>
        <p className="partner-muted partner-page-head__lead">
          Commerces contactés — cold call, mail, suivi.
        </p>
      </header>

      <section className="partner-card">
        <h2>Ajouter un commerce</h2>
        <form action={createProspectAction} className="partner-form">
          <div className="partner-form-grid partner-form-grid--2">
            <label>
              Contact *
              <input name="contactName" required placeholder="Prénom Nom" />
            </label>
            <label>
              Commerce *
              <input name="businessName" required placeholder="Nom de la boutique" />
            </label>
            <label>
              Ville
              <input name="city" placeholder="Paris" />
            </label>
            <label>
              Téléphone
              <input name="phone" placeholder="+336..." />
            </label>
            <label>
              Email
              <input name="email" type="email" placeholder="contact@..." />
            </label>
            <label>
              Prochaine relance
              <input name="nextFollowUpAt" type="datetime-local" />
            </label>
          </div>
          <label>
            Notes
            <textarea name="notes" rows={2} placeholder="Contexte, besoin…" />
          </label>
          <button type="submit" className="partner-btn partner-btn--lime">
            Ajouter
          </button>
        </form>
      </section>

      <section className="partner-card">
        <h2>
          Liste <em>({prospects.length})</em>
        </h2>
        {!prospects.length ? (
          <p className="partner-muted">Aucun prospect pour l’instant.</p>
        ) : (
          prospects.map((p) => (
            <div key={p.id} className="partner-row">
              <div>
                <strong className="partner-row__title">{p.businessName}</strong>
                <p className="partner-muted">
                  {p.contactName}
                  {p.city ? ` · ${p.city}` : ""}
                </p>
              </div>
              <div className="partner-inline-actions">
                <form
                  action={updateProspectStatusAction}
                  className="partner-inline-actions"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <select name="status" defaultValue={p.status} aria-label="Statut">
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="partner-btn partner-btn--sm">
                    OK
                  </button>
                </form>
                <form action={deleteProspectAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="partner-btn partner-btn--sm partner-btn--danger"
                    aria-label="Supprimer"
                  >
                    ×
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
