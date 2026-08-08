"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { MarginLogoMark } from "@/components/brand/MarginLogo";
import { planLogoTag } from "@/lib/plans";
import type { BreadcrumbItem } from "./types";

export function Topbar({
  breadcrumbs,
  onMenuClick,
  notificationCount = 0,
  onNotificationsClick,
  user,
  userMenu,
  actions,
  logoPlan = null,
}: {
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  onMenuClick?: () => void;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  user?: { name: string; email?: string; initials?: string } | null;
  userMenu?: ReactNode;
  actions?: ReactNode;
  logoPlan?: string | null;
}) {
  const [scrolled, setScrolled] = useState(false);
  const logoTag = planLogoTag(logoPlan);
  const initials =
    user?.initials ||
    user?.name
      ?.split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    "?";

  useEffect(() => {
    const scroller =
      document.querySelector<HTMLElement>(".ds-shell__content") || window;

    function onScroll() {
      const y =
        scroller === window
          ? window.scrollY
          : (scroller as HTMLElement).scrollTop;
      setScrolled(y > 12);
    }

    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`ds-top${scrolled ? " is-scrolled" : ""}`}>
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
        </div>
      </div>

      <div className="ds-top__brand">
        <Link
          href="/"
          className="ds-top__logo"
          aria-label={`Margin ${logoTag} — Accueil`}
        >
          <span className="ds-top__logo-mark" aria-hidden>
            <MarginLogoMark />
          </span>
          <span className="ds-top__logo-text">
            <span className="ds-top__logo-name">Margin</span>
            <span className="ds-top__logo-tag" aria-label={logoTag}>
              {logoTag.split("").map((ch, i) => (
                <span
                  key={`${logoTag}-${i}`}
                  className="ds-top__logo-tag-ch"
                  aria-hidden
                >
                  {ch}
                </span>
              ))}
            </span>
          </span>
        </Link>
      </div>

      <div className="ds-top__right">
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
