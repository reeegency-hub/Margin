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

      <div className="partner-page-head">
        <h1>Prospects</h1>
        <p className="partner-muted">
          Commerces contactés — cold call, mail, suivi.
        </p>
      </div>

      <div className="partner-card">
        <h2>Ajouter</h2>
        <form action={createProspectAction} className="partner-form">
          <input name="contactName" placeholder="Contact *" required />
          <input name="businessName" placeholder="Commerce *" required />
          <input name="city" placeholder="Ville" />
          <input name="phone" placeholder="Téléphone" />
          <input name="email" type="email" placeholder="Email" />
          <input name="nextFollowUpAt" type="datetime-local" />
          <textarea name="notes" placeholder="Notes" rows={2} />
          <button type="submit" className="partner-btn">
            Ajouter
          </button>
        </form>
      </div>

      <div className="partner-card">
        <h2>Liste ({prospects.length})</h2>
        {!prospects.length ? (
          <p className="partner-muted">Aucun prospect pour l’instant.</p>
        ) : (
          prospects.map((p) => (
            <div key={p.id} className="partner-row">
              <div>
                <strong>{p.businessName}</strong>
                <p className="partner-muted">
                  {p.contactName}
                  {p.city ? ` · ${p.city}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <form action={updateProspectStatusAction} style={{ display: "flex", gap: 4 }}>
                  <input type="hidden" name="id" value={p.id} />
                  <select name="status" defaultValue={p.status}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="partner-btn">
                    OK
                  </button>
                </form>
                <form action={deleteProspectAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="partner-btn">
                    ×
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
