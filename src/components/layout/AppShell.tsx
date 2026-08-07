"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type {
  AccountOption,
  BreadcrumbItem,
  NavGroupConfig,
} from "./types";

export function AppShell({
  brand,
  account,
  accounts,
  onAccountChange,
  navGroups,
  helpHref,
  helpLabel,
  sidebarFooter,
  topbarTitle,
  topbarGuide,
  breadcrumbs,
  notificationCount,
  onNotificationsClick,
  user,
  userMenu,
  topbarActions,
  banner,
  onAssistantClick,
  helpPanel,
  hideMenuOnDesktop = false,
  assistantPanel,
  children,
}: {
  brand?: ReactNode;
  account?: AccountOption | null;
  accounts?: AccountOption[];
  onAccountChange?: (id: string) => void;
  navGroups: NavGroupConfig[];
  helpHref?: string;
  helpLabel?: string;
  sidebarFooter?: ReactNode;
  topbarTitle?: string;
  topbarGuide?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  notificationCount?: number;
  onNotificationsClick?: () => void;
  user?: { name: string; email?: string; initials?: string } | null;
  userMenu?: ReactNode;
  topbarActions?: ReactNode;
  banner?: ReactNode;
  onAssistantClick?: () => void;
  helpPanel?: ReactNode;
  /** Sidebar rail desktop — masque le hamburger ≥768 */
  hideMenuOnDesktop?: boolean;
  /** Panneau assistant docké (style Cursor) */
  assistantPanel?: ReactNode;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const openAssistant = useCallback(() => {
    onAssistantClick?.();
  }, [onAssistantClick]);

  useEffect(() => {
    if (!onAssistantClick) return;
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "j") {
        e.preventDefault();
        openAssistant();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAssistantClick, openAssistant]);

  const sidebarProps = {
    brand,
    account,
    accounts,
    onAccountChange,
    groups: navGroups,
    footer: sidebarFooter,
    helpHref,
    helpLabel,
  };

  return (
    <div
      className={`ds-shell${hideMenuOnDesktop ? " ds-shell--rail" : ""}${
        assistantPanel ? " ds-shell--with-asst" : ""
      }`}
    >
      {banner ? <div className="ds-shell__banner">{banner}</div> : null}

      <div className="ds-shell__frame">
        {hideMenuOnDesktop ? (
          <div className="ds-side-rail" aria-hidden={false}>
            <Sidebar {...sidebarProps} mobile={false} open />
          </div>
        ) : null}

        <Sidebar
          {...sidebarProps}
          mobile
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />

        <div className="ds-shell__main">
          <Topbar
            title={topbarTitle}
            breadcrumbs={breadcrumbs}
            onMenuClick={() => setDrawerOpen(true)}
            notificationCount={notificationCount}
            onNotificationsClick={onNotificationsClick}
            user={user}
            userMenu={userMenu}
            actions={topbarActions}
          />
          <div className="ds-shell__content">{children}</div>
        </div>

        {assistantPanel}
      </div>

      {helpPanel}
    </div>
  );
}
