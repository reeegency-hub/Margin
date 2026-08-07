import { requireSession } from "@/lib/session";
import {
  getTodayPresence,
  detectUnderstaffing,
  listActiveEmployees,
  getMonthlyPayroll,
} from "@/lib/employee-engine";
import { BrandPage } from "@/components/brand/BrandCard";
import {
  clockInAction,
  markAbsentAction,
  planTodayShiftsAction,
} from "@/app/actions";
import Link from "next/link";
import { TeamSecondaryBlocks } from "@/components/employees/TeamSecondaryBlocks";

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

  const inkTitle =
    pending > 0
      ? `${pending} à pointer`
      : shifts.length === 0
        ? employees.length === 0
          ? "Aucune équipe"
          : "Personne planifiée"
        : "Tout le monde a pointé";

  const inkDetail = urgent
    ? `Attention : manque en ${ROLE_LABEL[urgent.role] || urgent.role}.`
    : shifts.length === 0
      ? employees.length === 0
        ? "Ajoutez l’équipe, puis planifiez la journée."
        : "Créez les créneaux du jour pour pouvoir pointer."
      : `${present} présent${present !== 1 ? "s" : ""}${
          absent > 0 ? ` · ${absent} absent${absent > 1 ? "s" : ""}` : ""
        }`;

  return (
    <BrandPage
      question="Qui travaille aujourd’hui ?"
      guide="Pointer Présent ou Absent."
    >
      {params.renamed ? <p className="flash">Nom mis à jour.</p> : null}
      {params.planned ? (
        <p className="flash">Créneaux du jour créés — vous pouvez pointer.</p>
      ) : null}

      <div className="dash-card dash-card--dark hub-now">
        <p className="hub-now__eyebrow">À faire maintenant</p>
        <p className="hub-now__title">{inkTitle}</p>
        <p className="hub-now__detail">{inkDetail}</p>
        <div className="hub-now__actions">
          {shifts.length === 0 && employees.length > 0 ? (
            <form action={planTodayShiftsAction}>
              <button type="submit" className="btn-lime">
                Planifier aujourd’hui
              </button>
            </form>
          ) : null}
          {employees.length === 0 ? (
            <Link href="/onboarding" className="btn-lime">
              Ajouter l’équipe
            </Link>
          ) : null}
          {shifts.length > 0 && pending > 0 ? (
            <p className="hub-now__hint">Pointez dans la liste ci-dessous.</p>
          ) : null}
          {shifts.length > 0 && pending === 0 ? (
            <p className="hub-now__hint">
              Planning de la semaine en bas de page.
            </p>
          ) : null}
        </div>
      </div>

      {shifts.length === 0 ? (
        <div className="dash-card dash-card--light hub-empty">
          <p>
            {employees.length === 0
              ? "Aucun membre d’équipe pour l’instant. Ajoutez des prénoms (ou terminez l’onboarding), puis planifiez la journée."
              : `${employees.length} personne${employees.length > 1 ? "s" : ""} en équipe, mais aucun créneau aujourd’hui.`}
          </p>
          <div className="hub-empty__actions">
            {employees.length > 0 ? (
              <form action={planTodayShiftsAction}>
                <button type="submit" className="pill-btn pill-btn--primary">
                  Planifier aujourd’hui
                </button>
              </form>
            ) : (
              <Link href="/onboarding" className="pill-btn pill-btn--primary">
                Ajouter l’équipe
              </Link>
            )}
            <Link href="/employees/planning" className="pill-btn pill-btn--ghost">
              Planning de la semaine
            </Link>
          </div>
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

      <p className="hub-secondary-link">
        <Link href="/employees/planning">Planning de la semaine →</Link>
      </p>

      <div className="dash-card dash-card--light team-wa-hint">
        <p className="team-wa-hint__title">Pointage WhatsApp</p>
        <p>Depuis le numéro gérant (Réglages) :</p>
        <ul>
          <li>
            <code>Julie 18:05</code> — arrivée
          </li>
          <li>
            <code>Julie départ 23:00</code> — fin de service
          </li>
        </ul>
      </div>

      <TeamSecondaryBlocks payroll={payroll} stubs={stubs} />
    </BrandPage>
  );
}
