import { requireSession } from "@/lib/session";
import {
  getTodayPresence,
  detectUnderstaffing,
  listActiveEmployees,
  getMonthlyPayroll,
} from "@/lib/employee-engine";
import { BrandPage } from "@/components/brand/BrandCard";
import { FeatureSection } from "@/components/ui/FeatureSection";
import {
  clockInAction,
  markAbsentAction,
  planTodayShiftsAction,
  renameEmployeeAction,
} from "@/app/actions";
import Link from "next/link";
import { Field, inputClass } from "@/components/ui";
import { euro } from "@/lib/dashboard";

function isStubName(name: string) {
  return /^(Salle|Cuisine|Livreur) \d+$/.test(name);
}

const ROLE_LABEL: Record<string, string> = {
  salle: "Caisse",
  cuisine: "Rayon",
  livreur: "Livreur",
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ renamed?: string; planned?: string }>;
}) {
  const session = await requireSession();
  const rid = session.user.restaurantId;
  const params = await searchParams;
  const [{ shifts }, employees, staffing, payroll] = await Promise.all([
    getTodayPresence(rid),
    listActiveEmployees(rid),
    detectUnderstaffing(rid),
    getMonthlyPayroll(rid),
  ]);
  const urgent = staffing[0];

  const present = shifts.filter((s) =>
    ["PRESENT", "LATE"].includes(s.attendances[0]?.status || "")
  ).length;
  const absent = shifts.filter((s) => s.attendances[0]?.status === "ABSENT")
    .length;
  const pending = shifts.filter((s) => !s.attendances[0]).length;
  const stubs = employees.filter((e) => isStubName(e.name));

  const orderedShifts = [...shifts].sort((a, b) => {
    const ap = a.attendances[0] ? 1 : 0;
    const bp = b.attendances[0] ? 1 : 0;
    return ap - bp;
  });

  return (
    <BrandPage
      question="Qui travaille aujourd’hui ?"
      guide="Pointer Présent ou Absent. WhatsApp : Julie 18:05."
    >
      {params.renamed ? <p className="flash">Nom mis à jour.</p> : null}
      {params.planned ? (
        <p className="flash">Créneaux du jour créés — vous pouvez pointer.</p>
      ) : null}

      <div
        className={`dash-card dash-card--light action-card ${
          urgent || pending > 0 ? "action-card--urgent" : "action-card--ok"
        }`}
      >
        <p className="action-card__title">
          {pending > 0
            ? `${pending} à pointer`
            : shifts.length === 0
              ? "Personne planifiée"
              : "Tout le monde a pointé"}
        </p>
        <p className="action-card__detail">
          {urgent
            ? `Attention : manque en ${ROLE_LABEL[urgent.role] || urgent.role}.`
            : shifts.length === 0
              ? "Créez les créneaux du jour en un clic."
              : `${present} présent${present !== 1 ? "s" : ""}${
                  absent > 0
                    ? ` · ${absent} absent${absent > 1 ? "s" : ""}`
                    : ""
                }`}
        </p>
        {shifts.length === 0 && employees.length > 0 ? (
          <form action={planTodayShiftsAction} className="mt-3">
            <button type="submit" className="pill-btn pill-btn--primary">
              Planifier aujourd’hui
            </button>
          </form>
        ) : (
          <Link href="/employees/planning" className="action-card__link">
            Planning
          </Link>
        )}
      </div>

      {shifts.length === 0 ? (
        <div className="dash-card dash-card--light space-y-3">
          <p className="text-[15px] text-[var(--text-muted)]">
            {employees.length === 0
              ? "Aucun membre d’équipe."
              : `${employees.length} personne(s) en équipe, mais aucun créneau aujourd’hui.`}
          </p>
        </div>
      ) : (
        <div className="dash-card dash-card--light team-today">
          {orderedShifts.map((s) => {
            const status = s.attendances[0]?.status ?? null;
            const att = s.attendances[0];
            const clockLabel =
              att?.clockIn &&
              att.clockIn.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              });
            return (
              <div key={s.id} className="team-today__row">
                <div>
                  <strong>{s.employee.name}</strong>
                  <p>
                    {s.startTime}–{s.endTime}
                    {status
                      ? ` · ${
                          status === "ABSENT"
                            ? "Absent"
                            : status === "LATE"
                              ? "En retard"
                              : "Présent"
                        }${clockLabel ? ` (${clockLabel})` : ""}`
                      : " · À pointer"}
                  </p>
                </div>
                {!status ? (
                  <div className="team-today__actions">
                    <form action={clockInAction}>
                      <input
                        type="hidden"
                        name="employeeId"
                        value={s.employeeId}
                      />
                      <input type="hidden" name="shiftId" value={s.id} />
                      <button
                        type="submit"
                        className="pill-btn pill-btn--primary pill-btn--sm"
                      >
                        Présent
                      </button>
                    </form>
                    <form action={markAbsentAction}>
                      <input
                        type="hidden"
                        name="employeeId"
                        value={s.employeeId}
                      />
                      <input type="hidden" name="shiftId" value={s.id} />
                      <button
                        type="submit"
                        className="pill-btn pill-btn--ghost pill-btn--sm"
                      >
                        Absent
                      </button>
                    </form>
                  </div>
                ) : (
                  <span
                    className={`team-today__badge ${
                      status === "ABSENT" ? "is-bad" : "is-ok"
                    }`}
                  >
                    {status === "ABSENT"
                      ? "Absent"
                      : status === "LATE"
                        ? "Retard"
                        : "Présent"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="phone-only team-payroll-teaser">
        Voir les heures & salaires estimés → ouvrez Équipe sur ordinateur.
      </p>

      <div className="phone-hide space-y-4">
        <FeatureSection
          title="Pointage WhatsApp"
          subtitle="Depuis votre numéro gérant branché dans Paramètres."
        />
        <div className="dash-card dash-card--light team-wa-hint">
          <p>Envoyez un message WhatsApp à Margin :</p>
          <ul>
            <li>
              <code>Julie 18:05</code> — arrivée
            </li>
            <li>
              <code>Julie départ 23:00</code> — fin de service
            </li>
          </ul>
          <p className="team-wa-hint__note">
            Le prénom doit correspondre à l’équipe. Les heures et le salaire
            estimé se mettent à jour ci-dessous.
          </p>
        </div>

        <FeatureSection
          title={`Heures & salaires — ${payroll.periodLabel}`}
          subtitle="Estimé = heures pointées × taux horaire. Pas une fiche de paie officielle."
        />
        <div className="dash-card dash-card--dark team-payroll">
          {payroll.rows.length === 0 ? (
            <p className="text-[15px] text-[var(--text-muted)]">
              Aucun membre d’équipe.
            </p>
          ) : (
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
          )}
        </div>
      </div>

      {stubs.length > 0 ? (
        <div className="phone-hide">
          <FeatureSection
            title="Donner un vrai prénom"
            subtitle="Remplacez les postes génériques (Caissier 1…) par les prénoms."
          />
          <div className="dash-card dash-card--dark space-y-4">
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
        </div>
      ) : null}

      <Link
        href="/employees/planning"
        className="pill-btn pill-btn--ghost phone-hide"
      >
        Voir / éditer le planning
      </Link>
    </BrandPage>
  );
}
