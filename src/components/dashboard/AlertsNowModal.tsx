"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { DashboardAlert } from "@/components/dashboard/dashboard-alert";
import { dismissAlertAction, treatAlertSentAction } from "@/app/actions";
import { alertWaMessage, buildWaMeLink } from "@/lib/wa-link";
import { WaSendLabel } from "@/components/ui/WhatsAppIcon";
import { useHomeAlerts } from "@/components/dashboard/HomeAlertsContext";

function isStockAlert(alert: DashboardAlert) {
  return (
    alert.type === "STOCK_CRITICAL" ||
    alert.title.toLowerCase().includes("stock")
  );
}

function alertHref(alert: DashboardAlert) {
  if (alert.ctaHref) return alert.ctaHref;
  if (isStockAlert(alert)) return "/orders";
  if (alert.title.toLowerCase().includes("effectif")) return "/employees";
  return "/";
}

function messageFor(restaurantName: string, alert: DashboardAlert) {
  return alertWaMessage(restaurantName, {
    title: alert.title,
    constat: alert.constat,
    action: alert.action,
    impact: alert.impact,
  });
}

/** Une seule auto-ouverture par session de connexion (pas à chaque retour Accueil). */
export const ALERTS_NOW_SESSION_KEY = "alerts-now-session-seen";

function readSessionSeen(): boolean {
  try {
    return sessionStorage.getItem(ALERTS_NOW_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSessionSeen() {
  try {
    sessionStorage.setItem(ALERTS_NOW_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Compteur pour distinguer un vrai départ Accueil d’un remount Strict Mode. */
let alertsNowMountGen = 0;

/**
 * Popup compact Accueil — une alerte à la fois.
 * S’ouvre automatiquement uniquement à la première visite Accueil de la connexion.
 */
export function AlertsNowModal({
  alerts,
  restaurantName,
  whatsappTo,
}: {
  alerts: DashboardAlert[];
  restaurantName: string;
  whatsappTo: string | null;
}) {
  const homeAlerts = useHomeAlerts();
  const markInlineAlertHandled = homeAlerts?.markInlineAlertHandled;
  const syncFingerprint = homeAlerts?.syncFingerprint;
  const fingerprint = useMemo(
    () => alerts.map((a) => a.id).sort().join(","),
    [alerts]
  );
  const [queue, setQueue] = useState(alerts);
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setQueue(alerts);
  }, [alerts]);

  useEffect(() => {
    syncFingerprint?.(fingerprint);
  }, [fingerprint, syncFingerprint]);

  useEffect(() => {
    if (!fingerprint) {
      setOpen(false);
      return;
    }
    if (readSessionSeen()) {
      setOpen(false);
      markInlineAlertHandled?.(fingerprint);
      return;
    }

    const gen = ++alertsNowMountGen;
    setOpen(true);

    const markTimer = window.setTimeout(() => {
      if (gen !== alertsNowMountGen) return;
      writeSessionSeen();
      markInlineAlertHandled?.(fingerprint);
    }, 400);

    return () => {
      window.clearTimeout(markTimer);
      // Vrai départ de l’Accueil (pas un remount Strict Mode immédiat)
      window.setTimeout(() => {
        if (gen !== alertsNowMountGen) return;
        writeSessionSeen();
        markInlineAlertHandled?.(fingerprint);
      }, 80);
    };
  }, [fingerprint, markInlineAlertHandled]);

  const closeForSession = useCallback(() => {
    writeSessionSeen();
    markInlineAlertHandled?.(fingerprint);
    setOpen(false);
  }, [fingerprint, markInlineAlertHandled]);

  function reopen() {
    setOpen(true);
  }

  function removeFromQueue(alertId: string) {
    setQueue((prev) => {
      const next = prev.filter((a) => a.id !== alertId);
      markInlineAlertHandled?.(fingerprint);
      if (next.length === 0) {
        writeSessionSeen();
        setOpen(false);
      }
      return next;
    });
  }

  function onCopy(alert: DashboardAlert) {
    const text = messageFor(restaurantName, alert);
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(alert.id);
      setTimeout(() => setCopiedId((id) => (id === alert.id ? null : id)), 1600);
    });
  }

  function onSend(alert: DashboardAlert) {
    const href =
      buildWaMeLink(whatsappTo, messageFor(restaurantName, alert)) ||
      "/settings?error=nonumber";
    if (!href.startsWith("https://")) {
      window.location.href = href;
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
    startTransition(async () => {
      await treatAlertSentAction(alert.id);
      removeFromQueue(alert.id);
    });
  }

  function onRefuse(alert: DashboardAlert) {
    startTransition(async () => {
      await dismissAlertAction(alert.id);
      removeFromQueue(alert.id);
    });
  }

  if (!alerts.length && !queue.length) return null;

  const total = queue.length;
  const alert = queue[0];
  const totalStart = Math.max(alerts.length, total);
  const step = totalStart - total + 1;

  return (
    <>
      {!open && total > 0 ? (
        <button type="button" className="alerts-now-chip" onClick={reopen}>
          {total} alerte{total > 1 ? "s" : ""}
        </button>
      ) : null}

      {open && alert ? (
        <div
          className="alerts-now-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="alerts-now-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForSession();
          }}
        >
          <div className="alerts-now-pop">
            <header className="alerts-now-pop__head">
              <p className="alerts-now-pop__step">
                {step}/{totalStart}
              </p>
              <button
                type="button"
                className="alerts-now-pop__close"
                aria-label="Fermer"
                onClick={closeForSession}
              >
                ×
              </button>
            </header>

            <h2 id="alerts-now-title" className="alerts-now-pop__title">
              {alert.title}
            </h2>
            <p className="alerts-now-pop__detail">{alert.constat}</p>
            {alert.action ? (
              <p className="alerts-now-pop__action">→ {alert.action}</p>
            ) : null}

            <div className="alerts-now-pop__actions">
              {isStockAlert(alert) ? (
                <>
                  <button
                    type="button"
                    className="alerts-now-pop__btn alerts-now-pop__btn--primary wa-send-btn"
                    onClick={() => onSend(alert)}
                    disabled={pending}
                  >
                    <WaSendLabel kind="alert" />
                  </button>
                  <button
                    type="button"
                    className="alerts-now-pop__btn"
                    onClick={() => onCopy(alert)}
                    disabled={pending}
                  >
                    {copiedId === alert.id ? "Copié" : "Copier"}
                  </button>
                  <button
                    type="button"
                    className="alerts-now-pop__btn"
                    onClick={() => onRefuse(alert)}
                    disabled={pending}
                  >
                    Refuser
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={alertHref(alert)}
                    className="alerts-now-pop__btn alerts-now-pop__btn--primary"
                    onClick={closeForSession}
                  >
                    Traiter
                  </Link>
                  <button
                    type="button"
                    className="alerts-now-pop__btn"
                    onClick={() => onRefuse(alert)}
                    disabled={pending}
                  >
                    Refuser
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              className="alerts-now-pop__later"
              onClick={closeForSession}
            >
              Plus tard
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
