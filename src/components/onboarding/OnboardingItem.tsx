"use client";

import type { OnboardingItemStatus } from "./types";

function StatusIcon({ status }: { status: OnboardingItemStatus }) {
  if (status === "done") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M3.5 8.2L6.4 11l6.1-7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "locked") {
    return (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect
          x="3"
          y="7"
          width="10"
          height="7"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M5 7V5a3 3 0 016 0v2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return null;
}

export function OnboardingItem({
  status,
  label,
  onClick,
}: {
  status: OnboardingItemStatus;
  label: string;
  onClick?: () => void;
}) {
  const className = `ob-item ob-item--${status}`;

  if (status === "todo" && onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <span className="ob-item__icon" aria-hidden>
          <StatusIcon status={status} />
        </span>
        <span className="ob-item__label">{label}</span>
        <span className="ob-item__chevron" aria-hidden>
          →
        </span>
      </button>
    );
  }

  return (
    <div
      className={className}
      aria-disabled={status === "locked" ? true : undefined}
    >
      <span className="ob-item__icon" aria-hidden>
        <StatusIcon status={status} />
      </span>
      <span className="ob-item__label">{label}</span>
    </div>
  );
}
