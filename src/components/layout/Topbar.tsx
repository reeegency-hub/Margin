"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { BreadcrumbItem } from "./types";

export function Topbar({
  title,
  breadcrumbs,
  onMenuClick,
  onAssistantClick,
  notificationCount = 0,
  onNotificationsClick,
  user,
  userMenu,
  actions,
}: {
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  onMenuClick?: () => void;
  onAssistantClick?: () => void;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  user?: { name: string; email?: string; initials?: string } | null;
  userMenu?: ReactNode;
  actions?: ReactNode;
}) {
  const initials =
    user?.initials ||
    user?.name
      ?.split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    "?";

  return (
    <header className="ds-top">
      <div className="ds-top__left">
        {onMenuClick ? (
          <button
            type="button"
            className="ds-top__icon-btn ds-top__menu"
            aria-label="Ouvrir le menu"
            onClick={onMenuClick}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        ) : null}

        <div className="ds-top__titles">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav className="ds-top__crumbs" aria-label="Fil d’Ariane">
              {breadcrumbs.map((crumb, i) => (
                <span key={`${crumb.label}-${i}`} className="ds-top__crumb">
                  {i > 0 ? <span className="ds-top__crumb-sep">/</span> : null}
                  {crumb.href ? (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  ) : (
                    <span aria-current={i === breadcrumbs.length - 1 ? "page" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}
          {title ? <h1 className="ds-top__title">{title}</h1> : null}
        </div>
      </div>

      <div className="ds-top__right">
        {onAssistantClick ? (
          <button
            type="button"
            className="ds-top__assistant"
            onClick={onAssistantClick}
            aria-label="Ouvrir l’assistant Margin"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M12 3a4 4 0 014 4v1h1a3 3 0 010 6h-.5" />
              <path d="M8 8V7a4 4 0 014-4" />
              <path d="M7 14h10v4a3 3 0 01-3 3h-4a3 3 0 01-3-3v-4z" />
              <path d="M9 17h.01M15 17h.01" />
            </svg>
            <span>Assistant</span>
          </button>
        ) : null}

        {actions}

        {onNotificationsClick ? (
          <button
            type="button"
            className="ds-top__icon-btn"
            aria-label={
              notificationCount > 0
                ? `Notifications (${notificationCount})`
                : "Notifications"
            }
            onClick={onNotificationsClick}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M6 9a6 6 0 0112 0c0 7 3 7 3 7H3s3 0 3-7" />
              <path d="M10 19a2 2 0 004 0" />
            </svg>
            {notificationCount > 0 ? (
              <span className="ds-top__badge" aria-hidden>
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
          </button>
        ) : null}

        {user ? (
          <details className="ds-top__user">
            <summary aria-label={`Compte ${user.name}`}>
              <span className="ds-top__avatar" aria-hidden>
                {initials}
              </span>
            </summary>
            <div className="ds-top__user-menu" role="menu">
              <div className="ds-top__user-meta">
                <strong>{user.name}</strong>
                {user.email ? <span>{user.email}</span> : null}
              </div>
              {userMenu}
            </div>
          </details>
        ) : null}
      </div>
    </header>
  );
}
