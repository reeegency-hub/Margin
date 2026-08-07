import { euro } from "@/lib/dashboard";
import { Field, inputClass } from "@/components/ui";
import { renameEmployeeAction } from "@/app/actions";

const ROLE_LABEL: Record<string, string> = {
  salle: "Caisse",
  cuisine: "Rayon",
  livreur: "Livreur",
};

type PayrollRow = {
  employeeId: string;
  name: string;
  role: string;
  daysPresent: number;
  hours: number;
  hourlyRate: number;
  estimatedPay: number;
};

type Payroll = {
  periodLabel: string;
  totalHours: number;
  totalPay: number;
  rows: PayrollRow[];
};

type Stub = { id: string; name: string };

/** Secondaire : hors premier viewport (salaires + renommage stubs). */
export function TeamSecondaryBlocks({
  payroll,
  stubs,
}: {
  payroll: Payroll;
  stubs: Stub[];
}) {
  return (
    <>
      <div className="dash-card dash-card--dark team-payroll">
        <p className="team-payroll__head">
          Heures & salaires — {payroll.periodLabel}
        </p>
        <p className="team-payroll__sub">
          Estimé = heures pointées × taux. Pas une fiche de paie.
        </p>
        {payroll.rows.length === 0 ? (
          <p className="text-[15px] opacity-70">Aucun membre d’équipe.</p>
        ) : (
          <div className="team-payroll__scroll">
            <table className="team-payroll__table">
              <thead>
                <tr>
                  <th>Personne</th>
                  <th>Poste</th>
                  <th>Jours</th>
                  <th>Heures</th>
                  <th>€/h</th>
                  <th>Estimé</th>
                </tr>
              </thead>
              <tbody>
                {payroll.rows.map((r) => (
                  <tr key={r.employeeId}>
                    <td>{r.name}</td>
                    <td>{ROLE_LABEL[r.role] || r.role}</td>
                    <td className="tabular-nums">{r.daysPresent}</td>
                    <td className="tabular-nums">{r.hours.toFixed(1)} h</td>
                    <td className="tabular-nums">{euro(r.hourlyRate)}</td>
                    <td className="tabular-nums">
                      <strong>{euro(r.estimatedPay)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total mois</td>
                  <td className="tabular-nums">
                    {payroll.totalHours.toFixed(1)} h
                  </td>
                  <td />
                  <td className="tabular-nums">
                    <strong>{euro(payroll.totalPay)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {stubs.length > 0 ? (
        <div className="dash-card dash-card--light space-y-4">
          <p className="hub-section-title">Donner un vrai prénom</p>
          <p className="hub-section-lead">
            Remplacez les postes génériques par les prénoms.
          </p>
          {stubs.map((e) => (
            <form
              key={e.id}
              action={renameEmployeeAction}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="employeeId" value={e.id} />
              <Field label={e.name}>
                <input
                  name="name"
                  className={inputClass}
                  placeholder="Prénom Nom"
                  required
                />
              </Field>
              <button type="submit" className="pill-btn pill-btn--primary">
                Renommer
              </button>
            </form>
          ))}
        </div>
      ) : null}
    </>
  );
}
