"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

export function OnboardingStepModal({
  open,
  onClose,
  onContinue,
  onSkip,
  title,
  description,
  illustration,
  continueLabel = "Continuer",
  skipLabel = "Passer",
  /** 0–1 : avance réelle du parcours (tâches faites / total) */
  progress = 0,
  sectionTitle,
  incentives = [],
  optional = false,
}: {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  onSkip?: () => void;
  title: string;
  description?: ReactNode;
  illustration?: ReactNode;
  continueLabel?: string;
  skipLabel?: string;
  progress?: number;
  sectionTitle?: string;
  incentives?: string[];
  optional?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const showSkip = Boolean(optional && onSkip);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const primary = panel?.querySelector<HTMLElement>(".ob-modal__continue");
    (primary || focusables?.[0])?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = [
        ...(panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) || []),
      ].filter((el) => !el.hasAttribute("disabled"));
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div
      className="ob-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="ob-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="ob-modal__head">
          <div className="ob-modal__kicker">
            {sectionTitle ? (
              <span className="ob-modal__section-pill">{sectionTitle}</span>
            ) : null}
            {optional ? (
              <span className="ob-modal__optional-pill">Optionnel</span>
            ) : null}
          </div>
          <button
            type="button"
            className="ob-modal__close"
            aria-label="Fermer"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div
          className="ob-modal__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Progression du parcours"
        >
          <i style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%` }} />
        </div>

        <div className="ob-modal__body">
          <h1 id={titleId} className="ob-modal__title">
            {title}
          </h1>
          {description ? (
            <div className="ob-modal__desc">{description}</div>
          ) : null}

          {incentives.length > 0 ? (
            <div className="ob-modal__incentives">
              <p className="ob-modal__incentives-title">
                Sur la page suivante
              </p>
              <ul>
                {incentives.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {illustration ? (
            <div className="ob-modal__illu">{illustration}</div>
          ) : null}
        </div>

        <footer
          className={`ob-modal__foot${showSkip ? "" : " ob-modal__foot--single"}`}
        >
          {showSkip ? (
            <button
              type="button"
              className="ob-modal__skip"
              onClick={onSkip}
            >
              {skipLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="ob-modal__continue"
            onClick={onContinue}
          >
            {continueLabel}
            <span aria-hidden> →</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
