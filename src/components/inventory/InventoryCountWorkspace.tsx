"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveInventoryDraft,
  validateInventoryAction,
} from "@/app/actions";
import {
  displayUnitLabel,
  formatKitchenQty,
  preferredDisplayUnit,
  toDisplayQty,
  toStorageQty,
} from "@/lib/units";

export type CountLine = {
  id: string;
  name: string;
  unit: string;
  theoreticalQty: number;
  countedQty: number;
  critical: boolean;
  threshold: number;
};

/**
 * Vérification rayon : indiquer ce qu’il y a vraiment dans le commerce.
 * Valider = corriger le stock appli (et donc les prochaines courses).
 */
export function InventoryCountWorkspace({
  inventoryId,
  lines: initial,
  editable,
}: {
  inventoryId: string;
  lines: CountLine[];
  editable: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"tous" | "ecarts" | "critiques">("tous");
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      initial.map((l) => {
        const d = preferredDisplayUnit(l.unit, l.name);
        return [l.id, toDisplayQty(l.countedQty, d)];
      })
    )
  );

  const sorted = useMemo(() => {
    return [...initial].sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      return a.name.localeCompare(b.name, "fr");
    });
  }, [initial]);

  const rows = useMemo(() => {
    return sorted.filter((l) => {
      const d = preferredDisplayUnit(l.unit, l.name);
      const theo = toDisplayQty(l.theoreticalQty, d);
      const counted = values[l.id] ?? theo;
      const diff = Math.abs(counted - theo) > 0.001;
      if (filter === "critiques") return l.critical;
      if (filter === "ecarts") return diff;
      return true;
    });
  }, [sorted, values, filter]);

  const changedCount = useMemo(() => {
    return initial.filter((l) => {
      const d = preferredDisplayUnit(l.unit, l.name);
      const theo = toDisplayQty(l.theoreticalQty, d);
      const counted = values[l.id] ?? theo;
      return Math.abs(counted - theo) > 0.001;
    }).length;
  }, [initial, values]);

  function buildFormData() {
    const fd = new FormData();
    fd.set("inventoryId", inventoryId);
    for (const l of initial) {
      const d = preferredDisplayUnit(l.unit, l.name);
      const displayQty = values[l.id] ?? toDisplayQty(l.theoreticalQty, d);
      const storage = toStorageQty(displayQty, d);
      fd.append("lineId", l.id);
      fd.append("countedQty", String(storage));
    }
    return fd;
  }

  function onSave() {
    startTransition(async () => {
      await saveInventoryDraft(buildFormData());
      router.refresh();
    });
  }

  function onValidate() {
    startTransition(async () => {
      await validateInventoryAction(buildFormData());
    });
  }

  function setOkLikeApp(line: CountLine) {
    const d = preferredDisplayUnit(line.unit, line.name);
    setValues((prev) => ({
      ...prev,
      [line.id]: toDisplayQty(line.theoreticalQty, d),
    }));
  }

  if (!editable) {
    return (
      <div className="inv-workspace">
        <ul className="inv-workspace__list">
          {sorted.map((l) => {
            const d = preferredDisplayUnit(l.unit, l.name);
            const theo = toDisplayQty(l.theoreticalQty, d);
            const counted = toDisplayQty(l.countedQty, d);
            const diff = counted - theo;
            return (
              <li key={l.id} className="inv-row">
                <div className="inv-row__main">
                  <strong>{l.name}</strong>
                  <span>
                    Appli {formatKitchenQty(l.theoreticalQty, l.unit, l.name)} →
                    compté {formatKitchenQty(l.countedQty, l.unit, l.name)}
                  </span>
                </div>
                <span
                  className={`inv-row__diff ${
                    Math.abs(diff) < 0.001
                      ? "inv-row__diff--ok"
                      : diff < 0
                        ? "inv-row__diff--down"
                        : "inv-row__diff--up"
                  }`}
                >
                  {Math.abs(diff) < 0.001
                    ? "OK"
                    : `${diff > 0 ? "+" : ""}${diff.toFixed(diff < 10 ? 2 : 1)} ${displayUnitLabel(d)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="inv-workspace">
      <div className="inv-workspace__intro">
        <p>
          Pour chaque produit : regardez le rayon, tapez la quantité réelle.
          Ce qui ne change pas, laissez comme l’appli.
        </p>
        <p className="inv-workspace__meta">
          {changedCount > 0
            ? `${changedCount} produit${changedCount > 1 ? "s" : ""} modifié${changedCount > 1 ? "s" : ""}`
            : "Aucun écart pour l’instant"}
        </p>
      </div>

      <div className="inv-workspace__filters">
        {(
          [
            ["tous", "Tous"],
            ["critiques", "À risque"],
            ["ecarts", "Écarts"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`inv-workspace__filter${
              filter === key ? " inv-workspace__filter--on" : ""
            }`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="inv-workspace__list">
        {rows.map((l) => {
          const d = preferredDisplayUnit(l.unit, l.name);
          const unitLbl = displayUnitLabel(d);
          const theo = toDisplayQty(l.theoreticalQty, d);
          const counted = values[l.id] ?? theo;
          const diff = counted - theo;
          return (
            <li
              key={l.id}
              className={`inv-row${l.critical ? " inv-row--critical" : ""}`}
            >
              <div className="inv-row__main">
                <strong>
                  {l.name}
                  {l.critical ? <em> À risque</em> : null}
                </strong>
                <span>
                  L’appli dit{" "}
                  <b>{formatKitchenQty(l.theoreticalQty, l.unit, l.name)}</b>
                </span>
              </div>
              <div className="inv-row__count">
                <label>
                  Dans le commerce ({unitLbl})
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={Number.isFinite(counted) ? counted : 0}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [l.id]: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="inv-row__ok"
                  onClick={() => setOkLikeApp(l)}
                >
                  Comme l’appli
                </button>
              </div>
              <div
                className={`inv-row__diff ${
                  Math.abs(diff) < 0.001
                    ? "inv-row__diff--ok"
                    : diff < 0
                      ? "inv-row__diff--down"
                      : "inv-row__diff--up"
                }`}
              >
                {Math.abs(diff) < 0.001
                  ? "OK"
                  : `${diff > 0 ? "+" : ""}${diff.toFixed(diff < 10 ? 2 : 1)} ${unitLbl}`}
              </div>
            </li>
          );
        })}
        {rows.length === 0 ? (
          <li className="inv-workspace__empty">Rien dans ce filtre.</li>
        ) : null}
      </ul>

      <div className="inv-workspace__foot">
        <button
          type="button"
          className="btn-ghost"
          disabled={pending}
          onClick={onSave}
        >
          Sauver
        </button>
        <button
          type="button"
          className="btn-lime"
          disabled={pending}
          onClick={onValidate}
        >
          {pending ? "Correction…" : "Valider · corriger le stock"}
        </button>
      </div>
      <p className="inv-workspace__foot-hint">
        Après validation, le stock appli = le commerce. Les prochaines listes
        Courses et alertes se basent dessus.
      </p>
    </div>
  );
}
