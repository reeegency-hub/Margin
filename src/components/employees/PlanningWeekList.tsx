"use client";

import { useMemo, useState } from "react";
import { deleteShiftAction } from "@/app/actions";

export type PlanningShiftRow = {
  id: string;
  dateKey: string;
  dateLabel: string;
  employeeName: string;
  role: string;
  startTime: string;
  endTime: string;
  isToday: boolean;
  /** Dates after today (same week window) */
  isUpcoming?: boolean;
};

const FILTERS = [
  { key: "today" as const, label: "Aujourd’hui" },
  { key: "week" as const, label: "Semaine" },
  { key: "tous" as const, label: "Tous" },
];

const PREVIEW = 6;

/**
 * Planning : filtres + liste courte avec Voir plus / moins.
 * Semaine = dates ≥ aujourd’hui (aujourd’hui + à venir).
 */
export function PlanningWeekList({ shifts }: { shifts: PlanningShiftRow[] }) {
  const [filter, setFilter] = useState<"tous" | "today" | "week">("today");
  const [expanded, setExpanded] = useState(false);

  // Semaine = aujourd’hui + à venir uniquement (jamais le passé)
  const weekShifts = useMemo(
    () => shifts.filter((s) => s.isToday || s.isUpcoming === true),
    [shifts]
  );

  const filtered = useMemo(() => {
    if (filter === "today") return shifts.filter((s) => s.isToday);
    if (filter === "week") return weekShifts;
    return shifts;
  }, [shifts, filter, weekShifts]);

  const visible = expanded ? filtered : filtered.slice(0, PREVIEW);
  const canToggle = filtered.length > PREVIEW;

  if (shifts.length === 0) {
    return (
      <p className="text-[15px] text-[var(--text-muted)]">
        Aucun créneau planifié sur les 7 prochains jours. Ajoutez-en ci-dessous.
      </p>
    );
  }

  return (
    <div className="planning-list">
      <div
        className="planning-list__filters"
        role="tablist"
        aria-label="Filtrer le planning"
      >
        {FILTERS.map((f) => {
          const count =
            f.key === "today"
              ? shifts.filter((s) => s.isToday).length
              : f.key === "week"
                ? weekShifts.length
                : shifts.length;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`planning-list__filter${
                filter === f.key ? " planning-list__filter--on" : ""
              }`}
              onClick={() => {
                setFilter(f.key);
                setExpanded(false);
              }}
            >
              {f.label}
              <span className="planning-list__count">{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="planning-list__empty">
          {filter === "today"
            ? "Rien aujourd’hui — ajoutez un créneau ci-dessous."
            : filter === "week"
              ? "Rien de prévu cette semaine."
              : "Aucun créneau dans ce filtre."}
        </p>
      ) : (
        <ul className="planning-list__rows">
          {visible.map((s) => (
            <li key={s.id} className="planning-list__row">
              <div className="planning-list__main">
                <strong>{s.employeeName}</strong>
                <span>
                  {s.dateLabel} · {s.startTime}–{s.endTime}
                  {s.role ? ` · ${s.role}` : ""}
                </span>
              </div>
              <form action={deleteShiftAction}>
                <input type="hidden" name="shiftId" value={s.id} />
                <button
                  type="submit"
                  className="pill-btn pill-btn--ghost pill-btn--sm"
                >
                  Retirer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {canToggle ? (
        <button
          type="button"
          className="list-expand-btn"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? "Voir moins"
            : `Voir plus (${filtered.length - PREVIEW} autres)`}
        </button>
      ) : null}
    </div>
  );
}
