"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Flag = { code: string; message: string; rowIndex?: number; field?: string };

type DraftPayload = {
  id: string;
  kind: string;
  status: string;
  sourceFileName?: string | null;
  payload: Record<string, unknown>;
  flags: Flag[];
};

const BLOCKING = new Set([
  "missing_name_column",
  "shift_overlap",
  "bad_phone",
  "empty",
]);

export function SetupDraftConfirm({
  draftId,
  onDone,
}: {
  draftId: string;
  onDone?: (summary: string) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/assistant/drafts/${draftId}`);
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || "Brouillon introuvable.");
        return;
      }
      setDraft(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  async function savePayload(nextPayload: Record<string, unknown>) {
    if (!draft) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/assistant/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: nextPayload, flags: draft.flags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible d’enregistrer la correction.");
        return false;
      }
      setDraft((d) =>
        d
          ? {
              ...d,
              payload: data.payload,
              flags: data.flags,
              status: data.status,
            }
          : d
      );
      return true;
    } finally {
      setSaving(false);
    }
  }

  function updateInventoryCell(
    index: number,
    field: "name" | "stock" | "price" | "unit",
    value: string
  ): Record<string, unknown> | null {
    if (!draft) return null;
    const rows = Array.isArray(draft.payload.rows)
      ? [...(draft.payload.rows as Record<string, unknown>[])]
      : [];
    const row = { ...(rows[index] || {}) };
    if (field === "name" || field === "unit") {
      row[field] = value;
    } else if (field === "stock") {
      const n = Number(value.replace(",", "."));
      row.stock = Number.isFinite(n) ? Math.max(0, n) : 0;
    } else if (field === "price") {
      const trimmed = value.trim();
      if (!trimmed) {
        delete row.price;
      } else {
        const n = Number(trimmed.replace(",", "."));
        if (Number.isFinite(n) && n > 0) row.price = n;
        else delete row.price;
      }
    }
    rows[index] = row;
    const next = { ...draft.payload, rows };
    setDraft({ ...draft, payload: next });
    return next;
  }

  function apply() {
    if (!draft) return;
    startTransition(async () => {
      setError(null);
      if (draft.kind === "import_inventory") {
        const ok = await savePayload(draft.payload);
        if (!ok) return;
      }
      const res = await fetch(`/api/assistant/drafts/${draftId}/commit`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de l’application.");
        if (data.flags) {
          setDraft((d) => (d ? { ...d, flags: data.flags } : d));
        }
        return;
      }
      router.refresh();
      const summary =
        draft.kind === "import_inventory"
          ? `Inventaire appliqué : ${data.result?.created ?? 0} créé(s), ${data.result?.updated ?? 0} mis à jour.`
          : draft.kind === "upsert_team"
            ? `Équipe appliquée : ${data.result?.employeesCreated ?? 0} personne(s), ${data.result?.shiftsCreated ?? 0} créneau(x).`
            : `WhatsApp enregistré : ${data.result?.phone ?? ""}.`;
      onDone?.(summary);
    });
  }

  if (error && !draft) {
    return <p className="setup-draft__error">{error}</p>;
  }
  if (!draft) {
    return <p className="setup-draft__loading">Chargement de l’aperçu…</p>;
  }

  const blocking = draft.flags.some((f) => BLOCKING.has(f.code));
  const rows = Array.isArray(draft.payload.rows)
    ? (draft.payload.rows as Record<string, unknown>[])
    : [];
  const employees = Array.isArray(draft.payload.employees)
    ? (draft.payload.employees as Record<string, unknown>[])
    : [];
  const phone = String(draft.payload.phone || "");

  return (
    <div className="setup-draft">
      <p className="setup-draft__eyebrow">Aperçu — confirmation requise</p>
      <p className="setup-draft__title">
        {draft.kind === "import_inventory"
          ? "Inventaire"
          : draft.kind === "upsert_team"
            ? "Équipe & planning"
            : "WhatsApp"}
        {draft.sourceFileName ? ` · ${draft.sourceFileName}` : ""}
      </p>

      {draft.flags.length > 0 ? (
        <ul className="setup-draft__flags">
          {draft.flags.map((f, i) => (
            <li key={`${f.code}-${i}`} className={BLOCKING.has(f.code) ? "is-block" : ""}>
              {f.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="setup-draft__ok">Aucune ambiguïté bloquante détectée.</p>
      )}

      {draft.kind === "import_inventory" ? (
        <div className="setup-draft__table-wrap">
          <table className="setup-draft__table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Stock</th>
                <th>Prix</th>
                <th>Unité</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 40).map((r, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className="setup-draft__input"
                      value={String(r.name || "")}
                      disabled={pending || draft.status === "committed"}
                      onChange={(e) =>
                        updateInventoryCell(i, "name", e.target.value)
                      }
                      onBlur={(e) => {
                        const next = updateInventoryCell(
                          i,
                          "name",
                          e.target.value
                        );
                        if (next) void savePayload(next);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="setup-draft__input setup-draft__input--num"
                      value={String(r.stock ?? 0)}
                      disabled={pending || draft.status === "committed"}
                      onChange={(e) =>
                        updateInventoryCell(i, "stock", e.target.value)
                      }
                      onBlur={(e) => {
                        const next = updateInventoryCell(
                          i,
                          "stock",
                          e.target.value
                        );
                        if (next) void savePayload(next);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="setup-draft__input setup-draft__input--num"
                      value={r.price != null ? String(r.price) : ""}
                      placeholder="—"
                      disabled={pending || draft.status === "committed"}
                      onChange={(e) =>
                        updateInventoryCell(i, "price", e.target.value)
                      }
                      onBlur={(e) => {
                        const next = updateInventoryCell(
                          i,
                          "price",
                          e.target.value
                        );
                        if (next) void savePayload(next);
                      }}
                    />
                  </td>
                  <td>
                    <select
                      className="setup-draft__input"
                      value={String(r.unit || "pcs")}
                      disabled={pending || draft.status === "committed"}
                      onChange={(e) => {
                        const next = updateInventoryCell(
                          i,
                          "unit",
                          e.target.value
                        );
                        if (next) void savePayload(next);
                      }}
                    >
                      <option value="pcs">pcs</option>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 40 ? (
            <p className="setup-draft__more">+{rows.length - 40} lignes</p>
          ) : null}
        </div>
      ) : null}

      {draft.kind === "upsert_team" ? (
        <ul className="setup-draft__list">
          {employees.map((e, i) => (
            <li key={i}>
              <strong>{String(e.name)}</strong> · {String(e.role)}
              {Array.isArray(e.shifts) && e.shifts.length
                ? ` · ${e.shifts.length} créneau(x)`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {draft.kind === "set_whatsapp" ? (
        <p className="setup-draft__phone">{phone}</p>
      ) : null}

      {error ? <p className="setup-draft__error">{error}</p> : null}

      <div className="setup-draft__actions">
        <button
          type="button"
          className="btn-lime"
          disabled={
            pending || saving || blocking || draft.status === "committed"
          }
          onClick={apply}
        >
          {pending
            ? "Application…"
            : saving
              ? "Enregistrement…"
              : draft.kind === "import_inventory"
                ? "Appliquer au stock"
                : draft.kind === "upsert_team"
                  ? "Appliquer l’équipe"
                  : draft.kind === "set_whatsapp"
                    ? "Enregistrer WhatsApp"
                    : "Appliquer"}
        </button>
        {blocking ? (
          <span className="setup-draft__hint">
            Corrigez les points bloquants (fichier / message) puis renvoyez.
          </span>
        ) : (
          <span className="setup-draft__hint">
            Rien n’est écrit tant que vous n’avez pas cliqué ce bouton.
          </span>
        )}
      </div>
    </div>
  );
}
