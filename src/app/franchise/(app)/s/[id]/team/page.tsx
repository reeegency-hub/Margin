import Link from "next/link";
import {
  getTodayPresence,
  detectUnderstaffing,
  listActiveEmployees,
} from "@/lib/employee-engine";
import {
  clockInAction,
  markAbsentAction,
  planTodayShiftsAction,
} from "@/app/actions";
import { requireFranchiseSession } from "../../../../actions";
import { prisma } from "@/lib/db";

const ROLE_LABEL: Record<string, string> = {
  salle: "Caisse",
  cuisine: "Rayon",
  livreur: "Livreur",
};

export default async function FranchiseTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFranchiseSession();
  const { id: rid } = await params;

  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: rid },
    select: { name: true },
  });

  const [{ shifts }, employees, staffing] = await Promise.all([
    getTodayPresence(rid),
    listActiveEmployees(rid),
    detectUnderstaffing(rid),
  ]);

  const pending = shifts.filter((s) => !s.attendances[0]).length;
  const urgent = staffing[0];
  const orderedShifts = [...shifts].sort((a, b) => {
    const ap = a.attendances[0] ? 1 : 0;
    const bp = b.attendances[0] ? 1 : 0;
    return ap - bp;
  });

  return (
    <div className="franchise-page">
      <header className="franchise-page-head">
        <p className="franchise-page-head__eyebrow">{restaurant.name}</p>
        <h1>Équipe</h1>
        <p className="franchise-page-head__lead">
          {pending > 0
            ? `${pending} à pointer`
            : shifts.length === 0
              ? employees.length === 0
                ? "Aucune équipe"
                : "Personne planifiée"
              : "Tout le monde a pointé"}
          {urgent
            ? ` · manque en ${ROLE_LABEL[urgent.role] || urgent.role}`
            : ""}
        </p>
      </header>

      <div className="franchise-inline-actions" style={{ marginBottom: "1rem" }}>
        {shifts.length === 0 && employees.length > 0 ? (
          <form action={planTodayShiftsAction}>
            <button type="submit" className="franchise-btn">
              Planifier aujourd’hui
            </button>
          </form>
        ) : null}
        <Link href="/onboarding" className="franchise-btn franchise-btn--ghost">
          Ajouter l’équipe
        </Link>
      </div>

      {orderedShifts.length === 0 ? (
        <p className="franchise-store-row__meta">
          Aucun créneau aujourd’hui.
        </p>
      ) : (
        <ul className="franchise-store-list">
          {orderedShifts.map((s) => {
            const status = s.attendances[0]?.status ?? null;
            return (
              <li key={s.id} className="franchise-store-row">
                <div>
                  <p className="franchise-store-row__name">{s.employee.name}</p>
                  <p className="franchise-store-row__meta">
                    {s.startTime}–{s.endTime}
                    {status
                      ? ` · ${
                          status === "ABSENT"
                            ? "Absent"
                            : status === "LATE"
                              ? "En retard"
                              : "Présent"
                        }`
                      : " · À pointer"}
                  </p>
                </div>
                {!status ? (
                  <div className="franchise-inline-actions">
                    <form action={clockInAction}>
                      <input
                        type="hidden"
                        name="employeeId"
                        value={s.employeeId}
                      />
                      <input type="hidden" name="shiftId" value={s.id} />
                      <button type="submit" className="franchise-btn franchise-btn--sm">
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
                        className="franchise-btn franchise-btn--ghost franchise-btn--sm"
                      >
                        Absent
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
