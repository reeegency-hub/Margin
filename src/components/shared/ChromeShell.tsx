"use client";

/**
 * Shell commun — le device vient du serveur (cookie).
 * MobileShell / DesktopShell ne font qu’embarquer ce composant avec un device fixe
 * pour permettre le code-splitting au niveau du layout.
 */

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { AppShell } from "@/components/layout/AppShell";
import type { NavGroupConfig } from "@/components/layout/types";
import { BottomNav } from "@/components/ui/BottomNav";
import { StockRuptureRecapModal } from "@/components/stock/StockRuptureRecapModal";
import { PageTitleProvider, usePageTitleValue } from "@/components/PageTitle";
import { FirstHourGuide } from "@/components/home/FirstHourGuide";
import { GuideFocusBanner } from "@/components/home/GuideFocusBanner";
import { PageFirstVisitTour } from "@/components/home/PageFirstVisitTour";
import {
  MarginAssistant,
  readExpandedDefault,
} from "@/components/assistant/MarginAssistant";
import { AssistantTopbarSpotlight } from "@/components/assistant/AssistantTopbarSpotlight";
import { MarginLogo } from "@/components/brand/MarginLogo";
import { SidebarWhatsApp } from "@/components/TopbarClient";
import { NAV_SECTIONS, type NavSection } from "@/lib/nav";
import { isFeatureEnabled } from "@/config/features";
import type { DeviceType } from "@/lib/device";
import type { DeviceShellProps } from "@/components/shared/shell-types";

function IconDash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-4 3-6.5 6.5-6.5S15.5 16 15.5 20" />
      <circle cx="17.5" cy="8.5" r="2.6" />
      <path d="M15.5 13.4c2.8.4 4.8 2.6 4.8 6.1" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2l2.4 11h10.2L20 8H7" />
    </svg>
  );
}

function IconStore() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 10h16v10H4z" />
      <path d="M3 10l2-5h14l2 5" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function IconEuro() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M18 6a7 7 0 100 12" />
      <path d="M5 10h10M5 14h8" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M12 3l8 4v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
    </svg>
  );
}

function iconFor(sectionId: NavSection["id"]) {
  if (sectionId === "home") return <IconDash />;
  if (sectionId === "equipe") return <IconPeople />;
  if (sectionId === "courses") return <IconCart />;
  if (sectionId === "couts") return <IconEuro />;
  if (sectionId === "magasin") return <IconStore />;
  return <IconBox />;
}

function buildNavGroups(isAdmin: boolean, device: DeviceType): NavGroupConfig[] {
  const allowCatalog = isFeatureEnabled("catalogImport", device);

  const main: NavGroupConfig = {
    id: "main",
    items: NAV_SECTIONS.map((section) => {
      const children = (section.children ?? [])
        .filter((child) => {
          const label = child.label.toLowerCase();
          if (
            label.includes("vue d’ensemble") ||
            label.includes("vue d'ensemble")
          ) {
            return false;
          }
          if (
            !allowCatalog &&
            (child.href.startsWith("/ingredients/menu") ||
              child.href.startsWith("/dishes"))
          ) {
            return false;
          }
          return true;
        })
        .map((child) => ({
          id: `${section.id}:${child.href}`,
          href: child.href,
          label: child.label,
          match: [child.href.split("#")[0] || child.href],
        }));

      return {
        id: section.id,
        href: section.href,
        label: section.label,
        icon: iconFor(section.id),
        match: section.match,
        children: children.length ? children : undefined,
      };
    }),
  };

  const groups: NavGroupConfig[] = [main];

  if (isAdmin && device === "desktop") {
    groups.unshift({
      id: "founder",
      items: [
        {
          id: "admin",
          href: "/admin",
          label: "Espace fondateur",
          icon: <IconShield />,
          match: ["/admin"],
        },
        {
          id: "admin-marketing",
          href: "/admin/marketing",
          label: "Marketing",
          icon: <IconShield />,
          match: ["/admin/marketing"],
        },
        {
          id: "admin-newsletter",
          href: "/admin/newsletter",
          label: "Newsletter",
          icon: <IconShield />,
          match: ["/admin/newsletter"],
        },
      ],
    });
  }

  return groups;
}

function ShellInner({
  device,
  restaurantName,
  restaurantId,
  planLabel,
  plan,
  whatsappTo,
  pendingStockRecap,
  forceMobileOverride,
  isAdmin,
  firstHour,
  children,
}: DeviceShellProps) {
  const pathname = usePathname();
  const pageTitle = usePageTitleValue();
  const isMobile = device === "mobile";

  const isHome = pathname === "/";
  const hideFirstHour = pathname.startsWith("/admin");
  const isFranchise = plan === "reseau";
  const [guideMinimized, setGuideMinimized] = useState(false);
  const [assistantExpanded, setAssistantExpanded] = useState(() =>
    isFeatureEnabled("copilotFullscreen", device)
  );

  useEffect(() => {
    if (isFeatureEnabled("copilotFullscreen", device)) {
      setAssistantExpanded(true);
      return;
    }
    setAssistantExpanded(readExpandedDefault());
  }, [device]);

  useEffect(() => {
    function onOpen() {
      setAssistantExpanded(true);
    }
    window.addEventListener("margin:open-assistant", onOpen);
    return () => window.removeEventListener("margin:open-assistant", onOpen);
  }, []);

  const guideLive = Boolean(firstHour?.bundle);
  const showFullscreenGuide =
    !hideFirstHour &&
    guideLive &&
    Boolean(firstHour?.active) &&
    isHome &&
    !guideMinimized;
  const showGuideDock =
    !hideFirstHour &&
    Boolean(firstHour?.bundle) &&
    Boolean(firstHour?.active) &&
    !showFullscreenGuide;

  const navGroups = useMemo(
    () => buildNavGroups(Boolean(isAdmin), device),
    [isAdmin, device]
  );

  const showUpgrade = isFeatureEnabled("upgradeCta", device);
  const showBottomNav = isFeatureEnabled("bottomNav", device);
  const showSpotlight = isFeatureEnabled("topbarSpotlight", device);

  const brand = (
    <div className="ds-chrome-brand">
      <MarginLogo tone="light" href="/" className="brand-logo" />
      <p className="ds-chrome-brand__plan">{planLabel}</p>
      {showUpgrade && !isFranchise ? (
        <Link href="/welcome#tarifs" className="ds-chrome-brand__upgrade">
          Passer à Franchise
        </Link>
      ) : null}
    </div>
  );

  const sidebarFooter = (
    <div className="ds-chrome-foot">
      <SidebarWhatsApp
        whatsappTo={whatsappTo}
        restaurantName={restaurantName}
      />
    </div>
  );

  const userMenu = (
    <>
      <Link href="/settings" role="menuitem">
        Réglages
      </Link>
      <button
        type="button"
        role="menuitem"
        onClick={() => void signOut({ callbackUrl: "/welcome" })}
      >
        Déconnexion
      </button>
    </>
  );

  const topbarTitle =
    pageTitle ||
    (isHome ? restaurantName : undefined) ||
    NAV_SECTIONS.find(
      (s) => pathname === s.href || pathname.startsWith(`${s.href}/`)
    )?.label;

  return (
    <div
      className={`ds-chrome${isMobile ? " ds-chrome--force-mobile" : ""}${
        showGuideDock ? " ds-chrome--with-guide" : ""
      }${assistantExpanded ? " ds-chrome--asst-open" : " ds-chrome--asst-collapsed"}${
        isFeatureEnabled("copilotFullscreen", device)
          ? " ds-chrome--copilot-focus"
          : ""
      }`}
      data-device={device}
    >
      <AppShell
        brand={brand}
        account={{
          id: "shop",
          name: restaurantName,
          subtitle: planLabel,
        }}
        navGroups={navGroups}
        helpHref="/settings"
        helpLabel="Aide commerce"
        sidebarFooter={sidebarFooter}
        topbarTitle={topbarTitle}
        logoPlan={plan}
        user={{ name: restaurantName }}
        userMenu={userMenu}
        hideMenuOnDesktop={isFeatureEnabled("sidebarNav", device)}
        onAssistantClick={() => setAssistantExpanded((v) => !v)}
        assistantPanel={
          <MarginAssistant
            expanded={assistantExpanded}
            onExpandedChange={setAssistantExpanded}
          />
        }
      >
        {forceMobileOverride ? (
          <div className="force-mobile-bar">
            <span>Mode téléphone</span>
            <Link href="/?mobile=0">Quitter</Link>
          </div>
        ) : null}
        {showFullscreenGuide ? (
          <FirstHourGuide
            state={firstHour!}
            restaurantId={restaurantId}
            mode="fullscreen"
            onMinimize={() => setGuideMinimized(true)}
            onExpand={() => setGuideMinimized(false)}
          />
        ) : (
          <>
            <Suspense fallback={null}>
              <GuideFocusBanner
                firstHour={firstHour}
                restaurantId={restaurantId}
              />
            </Suspense>
            <PageFirstVisitTour
              restaurantId={restaurantId}
              disabled={
                showFullscreenGuide ||
                showGuideDock ||
                Boolean(firstHour?.active)
              }
            />
            {children}
          </>
        )}
      </AppShell>

      {showBottomNav ? (
        <div className="block">
          <BottomNav isAdmin={isAdmin} />
        </div>
      ) : null}

      {showGuideDock ? (
        <FirstHourGuide
          state={firstHour!}
          restaurantId={restaurantId}
          mode="dock"
          onMinimize={() => setGuideMinimized(true)}
          onExpand={() => setGuideMinimized(false)}
        />
      ) : null}

      {pendingStockRecap && !isHome ? (
        <StockRuptureRecapModal summary={pendingStockRecap} />
      ) : null}

      {showSpotlight ? (
        <AssistantTopbarSpotlight
          restaurantId={restaurantId}
          enabled={isHome && !showFullscreenGuide}
          onOpenAssistant={() => setAssistantExpanded(true)}
        />
      ) : null}
    </div>
  );
}

export function ChromeShell(props: DeviceShellProps) {
  return (
    <PageTitleProvider>
      <ShellInner {...props} />
    </PageTitleProvider>
  );
}
