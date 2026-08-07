import { requireSession } from "@/lib/session";
import {
  getWeekShifts,
  listActiveEmployees,
  roleLabel,
} from "@/lib/employee-engine";
import { BrandPage } from "@/components/brand/BrandCard";
import Link from "next/link";
import { format, isSameDay, startOfDay } from "date-fns";
import { PlanningWeekList } from "@/components/employees/PlanningWeekList";
import { PlanningShiftForm } from "@/components/employees/PlanningShiftForm";

export default async function EmployeesPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    deleted?: string;
  }>;
}) {
  const session = await requireSession();
  const rid = session.user.restaurantId;
  const params = await searchParams;
  const [week, employees] = await Promise.all([
    getWeekShifts(rid),
    listActiveEmployees(rid),
  ]);
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const today = startOfDay(new Date());

  const todayCount = week.filter((s) => isSameDay(s.date, today)).length;

  const shiftRows = week.map((s) => {
    const day = startOfDay(s.date);
    const isToday = isSameDay(s.date, today);
    return {
      id: s.id,
      dateKey: format(s.date, "yyyy-MM-dd"),
      dateLabel: s.date.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
      }),
      employeeName: s.employee.name,
      role: roleLabel(s.employee.role),
      startTime: s.startTime,
      endTime: s.endTime,
      isToday,
      /** Après aujourd’hui (même fenêtre getWeekShifts) */
      isUpcoming: day.getTime() > today.getTime(),
    };
  });

  const employeeOptions = employees.map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    hourlyRate: e.hourlyRate,
  }));

  return (
    <BrandPage
      question="Planning de la semaine"
      guide="Aujourd’hui d’abord, puis la semaine. Ajoutez ou retirez des créneaux."
    >
      <Link href="/employees" className="pill-btn pill-btn--ghost mb-4">
        ← Aujourd’hui
      </Link>

      {params.created ? <p className="flash">Créneau ajouté.</p> : null}
      {params.deleted ? <p className="flash">Créneau supprimé.</p> : null}

      <div className="dash-card dash-card--dark hub-now">
        <p className="hub-now__eyebrow">Aujourd’hui</p>
        <p className="hub-now__title">
          {todayCount === 0
            ? "Aucun créneau aujourd’hui"
            : `${todayCount} créneau${todayCount > 1 ? "x" : ""} aujourd’hui`}
        </p>
        <p className="hub-now__detail">
          {employees.length === 0
            ? "Pas encore d’équipe active — les créneaux apparaîtront ici."
            : "Filtrez la liste, puis ajoutez un créneau plus bas si besoin."}
        </p>
        {employees.length > 0 ? (
          <div className="hub-now__actions">
            <Link href="/employees" className="btn-lime">
              Pointer l’équipe
            </Link>
          </div>
        ) : null}
      </div>

      {employees.length === 0 ? (
        <div className="dash-card dash-card--light hub-empty">
          <p>
            Aucun membre d’équipe. Ajoutez l’équipe d’abord, puis revenez ici
            pour planifier la semaine.
          </p>
          <div className="hub-empty__actions">
            <Link href="/employees" className="pill-btn pill-btn--primary">
              Ajouter l’équipe
            </Link>
            <Link href="/employees" className="pill-btn pill-btn--ghost">
              Retour à aujourd’hui
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="dash-card dash-card--light">
            <PlanningWeekList shifts={shiftRows} />
          </div>

          <details className="planning-add">
            <summary>Ajouter un créneau</summary>
            <PlanningShiftForm
              employees={employeeOptions}
              todayIso={todayIso}
            />
          </details>
        </>
      )}
    </BrandPage>
  );
}
