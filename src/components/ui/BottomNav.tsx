"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BOTTOM_TABS,
  NAV_SECTIONS,
  activeNavSection,
  isNavHrefActive,
} from "@/lib/nav";

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="9" r="2.4" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2l2.4 11h10.2L20 8H7" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function iconFor(href: string) {
  if (href === "/") return <IconHome />;
  if (href === "/employees") return <IconPeople />;
  if (href === "/orders") return <IconCart />;
  return <IconBox />;
}

export function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [navChrome, setNavChrome] = useState<
    "solid" | "transparent" | "hidden"
  >("solid");
  const titleId = useId();
  const activeSection = activeNavSection(pathname);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    function getScrollEl(): HTMLElement | Window {
      const main = document.querySelector(
        ".app-shell--force-mobile .main, .main"
      ) as HTMLElement | null;
      if (main && main.scrollHeight > main.clientHeight + 8) {
        return main;
      }
      return window;
    }

    function update() {
      const el = getScrollEl();
      let top = 0;
      let atBottom = false;

      if (el === window) {
        const doc = document.documentElement;
        top = window.scrollY || doc.scrollTop || 0;
        const max = Math.max(0, doc.scrollHeight - window.innerHeight);
        atBottom = max > 40 && top >= max - 48;
      } else {
        const node = el as HTMLElement;
        top = node.scrollTop;
        const max = Math.max(0, node.scrollHeight - node.clientHeight);
        atBottom = max > 40 && top >= max - 48;
      }

      if (atBottom) setNavChrome("hidden");
      else if (top < 36) setNavChrome("solid");
      else setNavChrome("transparent");
    }

    update();
    const main = document.querySelector(
      ".app-shell--force-mobile .main, .main"
    );
    window.addEventListener("scroll", update, { passive: true });
    main?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      main?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  const menuActive = open || !activeSection;

  const navClass =
    navChrome === "hidden"
      ? " bottom-nav--hidden"
      : navChrome === "transparent"
        ? " bottom-nav--transparent"
        : "";

  return (
    <>
      <nav
        className={`bottom-nav safe-bottom${navClass}`}
        aria-label="Navigation principale"
        aria-hidden={navChrome === "hidden"}
      >
        <div className="bottom-nav__inner">
          {BOTTOM_TABS.map((tab) => {
            const active = activeSection === tab.id;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`bottom-nav__item ${active ? "bottom-nav__item--active" : ""}`}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
              >
                <span className="bottom-nav__circle">
                  {iconFor(tab.href)}
                </span>
                <span className="bottom-nav__label">{tab.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={`bottom-nav__item bottom-nav__item--btn ${
              menuActive ? "bottom-nav__item--active" : ""
            }`}
            aria-label="Menu — toutes les pages"
            aria-expanded={open}
            aria-controls={titleId}
            onClick={() => setOpen(true)}
          >
            <span className="bottom-nav__circle">
              <IconMenu />
            </span>
            <span className="bottom-nav__label">Menu</span>
          </button>
        </div>
      </nav>

      {open ? (
        <div
          className="app-menu-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="app-menu-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="app-menu-sheet__handle" aria-hidden />
            <header className="app-menu-sheet__head">
              <h2 id={titleId}>Menu</h2>
              <button
                type="button"
                className="app-menu-sheet__close"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <p className="app-menu-sheet__hint">
              Accueil · Stock · Courses · Équipe · Magasin
            </p>
            <div className="app-menu-sheet__body">
              {NAV_SECTIONS.map((section) => (
                <div key={section.id} className="app-menu-sheet__section">
                  <p className="app-menu-sheet__section-title">
                    {section.label}
                  </p>
                  <ul className="app-menu-sheet__list">
                    <li>
                      <Link
                        href={section.href}
                        className={`app-menu-sheet__link${
                          isNavHrefActive(pathname, section.href)
                            ? " app-menu-sheet__link--active"
                            : ""
                        }`}
                        aria-current={
                          isNavHrefActive(pathname, section.href)
                            ? "page"
                            : undefined
                        }
                        onClick={() => setOpen(false)}
                      >
                        <span className="app-menu-sheet__link-label">
                          {section.children?.length
                            ? `Ouvrir ${section.label.toLowerCase()}`
                            : section.label}
                        </span>
                        {section.hint ? (
                          <span className="app-menu-sheet__link-hint">
                            {section.hint}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                    {(section.children ?? []).map((item) => {
                      if (item.href === section.href) return null;
                      const active = isNavHrefActive(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={`app-menu-sheet__link${
                              active ? " app-menu-sheet__link--active" : ""
                            }`}
                            aria-current={active ? "page" : undefined}
                            onClick={() => setOpen(false)}
                          >
                            <span className="app-menu-sheet__link-label">
                              {item.label}
                            </span>
                            {item.hint ? (
                              <span className="app-menu-sheet__link-hint">
                                {item.hint}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {isAdmin ? (
                <div className="app-menu-sheet__section">
                  <p className="app-menu-sheet__section-title">Fondateur</p>
                  <ul className="app-menu-sheet__list">
                    <li>
                      <Link
                        href="/admin"
                        className={`app-menu-sheet__link${
                          pathname === "/admin" ||
                          pathname.startsWith("/admin/stores")
                            ? " app-menu-sheet__link--active"
                            : ""
                        }`}
                        onClick={() => setOpen(false)}
                      >
                        <span className="app-menu-sheet__link-label">
                          Espace fondateur
                        </span>
                        <span className="app-menu-sheet__link-hint">
                          Clients, plans, configuration
                        </span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/admin/marketing"
                        className={`app-menu-sheet__link${
                          pathname.startsWith("/admin/marketing")
                            ? " app-menu-sheet__link--active"
                            : ""
                        }`}
                        onClick={() => setOpen(false)}
                      >
                        <span className="app-menu-sheet__link-label">
                          Marketing
                        </span>
                        <span className="app-menu-sheet__link-hint">
                          Cold email, influenceurs, playbook
                        </span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/admin/newsletter"
                        className={`app-menu-sheet__link${
                          pathname.startsWith("/admin/newsletter")
                            ? " app-menu-sheet__link--active"
                            : ""
                        }`}
                        onClick={() => setOpen(false)}
                      >
                        <span className="app-menu-sheet__link-label">
                          Newsletter
                        </span>
                        <span className="app-menu-sheet__link-hint">
                          Abonnés et export CSV
                        </span>
                      </Link>
                    </li>
                  </ul>
                </div>
              ) : null}
              <div className="app-menu-sheet__section">
                <button
                  type="button"
                  className="app-menu-sheet__link app-menu-sheet__logout"
                  onClick={() => signOut({ callbackUrl: "/welcome" })}
                >
                  <span className="app-menu-sheet__link-label">
                    Déconnexion
                  </span>
                  <span className="app-menu-sheet__link-hint">
                    Quitter le compte
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
