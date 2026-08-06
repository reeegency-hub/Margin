"use client";

import { useMemo, useState } from "react";
import { createShiftAction } from "@/app/actions";
import { Field, inputClass } from "@/components/ui";
import {
  DEFAULT_HOURLY_RATES,
  roleLabel,
} from "@/lib/employee-constants";

export type PlanningEmployeeOption = {
  id: string;
  name: string;
  role: string;
  hourlyRate: number;
};

type Props = {
  employees: PlanningEmployeeOption[];
  todayIso: string;
};

function formatRate(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function PlanningShiftForm({ employees, todayIso }: Props) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const selected = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? employees[0],
    [employees, employeeId]
  );
  const [hourlyRate, setHourlyRate] = useState(
    formatRate(selected?.hourlyRate ?? DEFAULT_HOURLY_RATES.salle)
  );

  if (!employees.length || !selected) return null;

  return (
    <form
      action={createShiftAction}
      className="planning-shift-form grid gap-3 sm:grid-cols-2"
    >
      <Field label="Personne">
        <select
          name="employeeId"
          className={inputClass}
          required
          value={employeeId}
          onChange={(e) => {
            const nextId = e.target.value;
            setEmployeeId(nextId);
            const next = employees.find((emp) => emp.id === nextId);
            if (next) setHourlyRate(formatRate(next.hourlyRate));
          }}
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({roleLabel(e.role)})
            </option>
          ))}
        </select>
      </Field>
      <label className="block space-y-1.5">
        <span className="field-label">
          Salaire €/h — {roleLabel(selected.role)}
        </span>
        <input
          type="number"
          name="hourlyRate"
          className={inputClass}
          min={0}
          max={200}
          step={0.5}
          required
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
        />
        <span className="block text-[12px] text-[var(--text-muted)]">
          Postes : caisse {formatRate(DEFAULT_HOURLY_RATES.salle)} € · rayon{" "}
          {formatRate(DEFAULT_HOURLY_RATES.cuisine)} € · livreur{" "}
          {formatRate(DEFAULT_HOURLY_RATES.livreur)} €
        </span>
      </label>
      <Field label="Date">
        <input
          type="date"
          name="date"
          className={inputClass}
          defaultValue={todayIso}
          required
        />
      </Field>
      <Field label="Début">
        <input
          type="time"
          name="startTime"
          className={inputClass}
          defaultValue="18:00"
          required
        />
      </Field>
      <Field label="Fin">
        <input
          type="time"
          name="endTime"
          className={inputClass}
          defaultValue="23:00"
          required
        />
      </Field>
      <div className="sm:col-span-2">
        <button type="submit" className="pill-btn pill-btn--primary">
          Ajouter au planning
        </button>
      </div>
    </form>
  );
}
