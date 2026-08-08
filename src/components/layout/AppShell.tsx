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
  logoPlan,
  notificationCount,
  onNotificationsClick,
  user,
  userMenu,
  topbarActions,
  banner,
  onAssistantClick,
  helpPanel,
  hideMenuOnDesktop = false,
  hideMobileDrawer = false,
  hideTopbar = false,
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
  logoPlan?: string | null;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  user?: { name: string; email?: string; initials?: string } | null;
  userMenu?: ReactNode;
  topbarActions?: ReactNode;
  banner?: ReactNode;
  onAssistantClick?: () => void;
  helpPanel?: ReactNode;
  hideMenuOnDesktop?: boolean;
  hideMobileDrawer?: boolean;
  hideTopbar?: boolean;
  assistantPanel?: ReactNode;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen || hideMobileDrawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen, hideMobileDrawer]);

  useEffect(() => {
    if (!hideMobileDrawer) return;
    setDrawerOpen(false);
    document.body.style.overflow = "";
  }, [hideMobileDrawer]);

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
      }${hideMobileDrawer ? " ds-shell--no-drawer" : ""}`}
    >
      {banner ? <div className="ds-shell__banner">{banner}</div> : null}

      <div className="ds-shell__frame">
        {hideMenuOnDesktop ? (
          <div className="ds-side-rail" aria-hidden={false}>
            <Sidebar {...sidebarProps} mobile={false} open />
          </div>
        ) : null}

        {!hideMobileDrawer ? (
          <Sidebar
            {...sidebarProps}
            mobile
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          />
        ) : null}

        <div
          className={`ds-shell__main${hideTopbar ? " ds-shell__main--flush" : ""}`}
        >
          {!hideTopbar ? (
            <Topbar
              title={topbarTitle}
              breadcrumbs={breadcrumbs}
              logoPlan={logoPlan}
              onMenuClick={
                hideMobileDrawer ? undefined : () => setDrawerOpen(true)
              }
              notificationCount={notificationCount}
              onNotificationsClick={onNotificationsClick}
              user={user}
              userMenu={userMenu}
              actions={topbarActions}
            />
          ) : null}
          <div className="ds-shell__content">{children}</div>
        </div>

        {assistantPanel}
      </div>

      {helpPanel}
    </div>
  );
}
