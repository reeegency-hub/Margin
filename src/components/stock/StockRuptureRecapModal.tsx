"use client";

import { useState, useTransition } from "react";
import type { StockAlertSummary } from "@/lib/stock-alert-service";
import {
  dismissStockRecapAction,
  sendStockRecapWhatsAppAction,
} from "@/app/actions";
import { WaSendLabel } from "@/components/ui/WhatsAppIcon";

export function StockRuptureRecapModal({
  summary,
}: {
  summary: StockAlertSummary;
}) {
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open || summary.nombre_produits < 1) return null;

  function onDismiss() {
    startTransition(async () => {
      await dismissStockRecapAction();
      setOpen(false);
    });
  }

  function onSend() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await sendStockRecapWhatsAppAction();
      if (!res.ok) {
        if (res.needSettings) {
          window.location.href = "/settings?error=nonumber";
          return;
        }
        setError(res.message);
        return;
      }
      if (res.waMeLink) {
        window.open(res.waMeLink, "_blank", "noopener,noreferrer");
      }
      setInfo(res.message);
      setTimeout(() => setOpen(false), res.simulated ? 1800 : 600);
    });
  }

  return (
    <div
      className="menu-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-recap-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="menu-modal stock-recap-modal">
        <div className="menu-modal__head">
          <h2 id="stock-recap-title">Récap rupture de stock</h2>
          <button
            type="button"
            className="menu-modal__close"
            aria-label="Fermer"
            onClick={onDismiss}
            disabled={pending}
          >
            ×
          </button>
        </div>

        <p className="menu-modal__hint">
          {summary.nombre_produits} produit
          {summary.nombre_produits > 1 ? "s" : ""} sous le seuil critique. Un
          seul message WhatsApp — pas besoin de commander produit par produit.
        </p>

        <ul className="stock-recap-list">
          {summary.liste.map((l) => (
            <li key={l.stockUnitId} className="stock-recap-list__item">
              <div>
                <strong>{l.nom}</strong>
                <p>
                  Reste {l.stockLabel} · seuil {l.seuilLabel}
                </p>
              </div>
              <span className="stock-recap-list__qty">→ {l.qtyLabel}</span>
            </li>
          ))}
        </ul>

        {error ? <p className="flash flash-warn mt-3">{error}</p> : null}
        {info ? <p className="flash mt-3">{info}</p> : null}

        <div className="menu-modal__actions">
          <button
            type="button"
            className="pill-btn pill-btn--ghost"
            onClick={onDismiss}
            disabled={pending}
          >
            Plus tard
          </button>
          <button
            type="button"
            className="pill-btn pill-btn--primary wa-send-btn"
            onClick={onSend}
            disabled={pending}
          >
            <WaSendLabel kind="list" />
            <span className="sr-only">Envoyer le récap</span>
          </button>
        </div>
      </div>
    </div>
  );
}
