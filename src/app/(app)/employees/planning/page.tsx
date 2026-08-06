import { requireSession } from "@/lib/session";
import {
  getWeekShifts,
  listActiveEmployees,
  roleLabel,
} from "@/lib/employee-engine";
import { BrandPage } from "@/components/brand/BrandCard";
import { FeatureSection } from "@/components/ui/FeatureSection";
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

  const shiftRows = week.map((s) => ({
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
    isToday: isSameDay(s.date, today),
  }));

  const employeeOptions = employees.map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    hourlyRate: e.hourlyRate,
  }));

  return (
    <BrandPage
      question="Planning de la semaine"
      guide="Aujourd’hui d’abord. Ajoutez ou retirez des créneaux."
    >
      <Link href="/employees" className="pill-btn pill-btn--ghost mb-4">
        ← Retour à aujourd’hui
      </Link>

      {params.created ? <p className="flash">Créneau ajouté.</p> : null}
      {params.deleted ? <p className="flash">Créneau supprimé.</p> : null}

      {employees.length > 0 ? (
        <>
          <FeatureSection
            title="Ajouter un créneau"
            subtitle="Qui travaille, salaire du poste, quel jour, quelles heures."
          />
          <PlanningShiftForm
            employees={employeeOptions}
            todayIso={todayIso}
          />
        </>
      ) : null}

      <FeatureSection
        next
        title="Créneaux"
        subtitle="Filtrez, puis retirez si besoin."
      />
      <div className="dash-card dash-card--light">
        <PlanningWeekList shifts={shiftRows} />
      </div>
    </BrandPage>
  );
}
