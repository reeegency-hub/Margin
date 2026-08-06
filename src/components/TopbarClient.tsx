"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WaSendLabel } from "@/components/ui/WhatsAppIcon";
import { buildWaMeLink } from "@/lib/wa-link";
import { usePageTitleValue, usePageGuideValue } from "@/components/PageTitle";

/** Accueil : date. Autres pages : titre + sous-titre guide. */
export function TopbarClient({
  whatsappTo,
  restaurantName,
}: {
  whatsappTo: string | null;
  restaurantName: string;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const pageTitle = usePageTitleValue();
  const pageGuide = usePageGuideValue();

  const dateLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const datePretty =
    dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  void whatsappTo;

  if (isHome) {
    return (
      <div className="topbar topbar--minimal topbar--home">
        <div className="topbar-home-shop">
          <p className="topbar-shop-name">{restaurantName}</p>
          <div className="date">{datePretty}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="topbar topbar--minimal topbar--page">
      <div className="topbar-page-copy">
        {pageTitle ? (
          <h1 className="topbar-page-title">{pageTitle}</h1>
        ) : (
          <span className="topbar-page-title topbar-page-title--placeholder" />
        )}
        {pageGuide ? (
          <p className="topbar-page-guide">{pageGuide}</p>
        ) : null}
      </div>
    </div>
  );
}

export function SidebarWhatsApp({
  whatsappTo,
  restaurantName,
}: {
  whatsappTo: string | null;
  restaurantName: string;
}) {
  const href =
    buildWaMeLink(
      whatsappTo,
      `${restaurantName} — Besoin d’aide Margin Shop ? Ouvrez l’app pour stock, réassort et équipe.`
    ) || "/settings?error=nonumber";
  const external = href.startsWith("https://");

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="wa-pill sidebar-wa-pill"
      >
        <span className="wa-dot" />
        <WaSendLabel kind="help" />
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="wa-pill sidebar-wa-pill"
      title="Ajoutez votre numéro WhatsApp"
    >
      <span className="wa-dot" />
      <WaSendLabel kind="help" />
    </Link>
  );
}
