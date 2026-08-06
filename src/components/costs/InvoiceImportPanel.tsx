"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProposedReceipt, ProposedReceiptLine } from "@/lib/invoice-import";
import {
  confirmInvoiceImportAction,
  uploadInvoiceFileAction,
} from "@/app/actions";

type SupplierOpt = { id: string; name: string };
type IngredientOpt = { id: string; name: string; unit: string };

type Props = {
  suppliers: SupplierOpt[];
  ingredients: IngredientOpt[];
};

export function InvoiceImportPanel({ suppliers, ingredients }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ProposedReceipt | null>(null);
  const [lines, setLines] = useState<ProposedReceiptLine[]>([]);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [note, setNote] = useState("");

  const matchedCount = useMemo(
    () => lines.filter((l) => l.ingredientId).length,
    [lines]
  );

  const reviewReady = useMemo(() => {
    const kept = lines.filter((l) => l.ingredientId);
    if (!kept.length) return false;
    return kept.every(
      (l) =>
        l.quantity > 0 &&
        l.unitPrice != null &&
        Number.isFinite(l.unitPrice) &&
        l.unitPrice > 0
    );
  }, [lines]);

  const onFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      setError(null);
      const fd = new FormData();
      fd.set("file", file);
      startTransition(async () => {
        const res = await uploadInvoiceFileAction(fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setReceipt(res.receipt);
        setLines(res.receipt.lines);
        setNote(res.receipt.note || "");
        if (res.receipt.supplierName) {
          const hit = suppliers.find(
            (s) =>
              s.name.toLowerCase() ===
              res.receipt.supplierName!.toLowerCase()
          );
          if (hit) setSupplierId(hit.id);
        }
      });
    },
    [suppliers]
  );

  const updateLine = useCallback(
    (index: number, patch: Partial<ProposedReceiptLine>) => {
      setLines((prev) =>
        prev.map((l, i) => {
          if (i !== index) return l;
          const next = { ...l, ...patch };
          if (patch.ingredientId) {
            const ing = ingredients.find((x) => x.id === patch.ingredientId);
            next.matchName = ing?.name ?? null;
          }
          return next;
        })
      );
    },
    [ingredients]
  );

  const confirm = useCallback(() => {
    const payloadLines = lines
      .filter(
        (l) =>
          l.ingredientId &&
          l.quantity > 0 &&
          l.unitPrice != null &&
          l.unitPrice > 0
      )
      .map((l) => ({
        ingredientId: l.ingredientId!,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      }));
    if (!payloadLines.length) {
      setError(
        "Chaque ligne importée doit avoir un produit matché, une quantité et un prix."
      );
      return;
    }
    startTransition(async () => {
      const res = await confirmInvoiceImportAction({
        supplierId,
        note: note || null,
        lines: payloadLines,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/costs?received=1");
      router.refresh();
    });
  }, [lines, note, router, supplierId]);

  if (receipt && lines.length) {
    return (
      <div className="catalog-import">
        <div className="catalog-import__preview">
          <p className="catalog-import__eyebrow">Aperçu</p>
          <p className="catalog-import__preview-title">Vérifiez le rattachement</p>
          <p className="catalog-import__lead">
            {matchedCount}/{lines.length} ligne{lines.length > 1 ? "s" : ""}{" "}
            rattachée{matchedCount > 1 ? "s" : ""} au stock
            {receipt.engine === "csv" ? " · CSV" : ""}
            {" — "}
            qty, prix et match obligatoires
          </p>

        <div className="costs-invoice-meta">
          <label>
            Fournisseur
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            N° / note
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="FAC-…"
            />
          </label>
        </div>

        <div className="costs-invoice-lines">
          <div className="costs-invoice-lines__head costs-invoice-lines__head--import">
            <span>Détecté</span>
            <span>Stock</span>
            <span>Qté</span>
            <span>€</span>
          </div>
          {lines.map((line, i) => (
            <div
              key={`${line.name}-${i}`}
              className="costs-invoice-lines__row costs-invoice-lines__row--import"
            >
              <span className="costs-invoice-lines__detected" title={line.name}>
                {line.name}
              </span>
              <select
                value={line.ingredientId || ""}
                onChange={(e) =>
                  updateLine(i, {
                    ingredientId: e.target.value || null,
                  })
                }
              >
                <option value="">— ignorer —</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.quantity || ""}
                onChange={(e) =>
                  updateLine(i, { quantity: Number(e.target.value) || 0 })
                }
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.unitPrice ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  updateLine(i, {
                    unitPrice: Number.isFinite(n) && n > 0 ? n : null,
                  });
                }}
              />
            </div>
          ))}
        </div>

        {error ? <p className="costs-invoice-import__error">{error}</p> : null}

        <div className="catalog-import__preview-actions">
          <button
            type="button"
            className="pill-btn pill-btn--ghost"
            disabled={pending}
            onClick={() => {
              setReceipt(null);
              setLines([]);
              setError(null);
            }}
          >
            Autre fichier
          </button>
          <button
            type="button"
            className="btn-lime"
            disabled={pending || !reviewReady}
            onClick={confirm}
          >
            {pending
              ? "Import…"
              : reviewReady
                ? `Importer · ${matchedCount}`
                : "Complétez qty / prix / match"}
          </button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="costs-invoice-import">
      <label className="costs-drop" data-guide-action="invoice-import">
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain,.pdf,image/*,application/pdf"
          disabled={pending}
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <strong>{pending ? "Analyse…" : "Importer la facture"}</strong>
        <span>
          CSV, PDF ou photo — jamais de saisie ligne à ligne · review obligatoire
        </span>
      </label>
      {error ? <p className="costs-invoice-import__error">{error}</p> : null}
    </div>
  );
}
