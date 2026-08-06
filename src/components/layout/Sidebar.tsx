"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { AccountOption, NavGroupConfig, NavItemConfig } from "./types";

function pathActive(pathname: string, item: NavItemConfig): boolean {
  const matches = item.match?.length ? item.match : [item.href];
  return matches.some((m) => {
    const base = m.split("#")[0] || m;
    if (base === "/") return pathname === "/";
    if (base === "/admin") {
      return (
        pathname === "/admin" || pathname.startsWith("/admin/stores")
      );
    }
    if (base === "/ingredients") {
      return (
        pathname === "/ingredients" ||
        (pathname.startsWith("/ingredients/") &&
          !pathname.startsWith("/ingredients/menu"))
      );
    }
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}

function childActive(pathname: string, item: NavItemConfig): boolean {
  const base = (item.href.split("#")[0] || item.href);
  if (base === "/") return pathname === "/";
  if (base === "/ingredients") {
    return (
      pathname === "/ingredients" ||
      (pathname.startsWith("/ingredients/") &&
        !pathname.startsWith("/ingredients/menu"))
    );
  }
  return pathname === base || pathname.startsWith(`${base}/`);
}

function sectionExpanded(pathname: string, item: NavItemConfig): boolean {
  if (!item.children?.length) return false;
  if (pathActive(pathname, item)) return true;
  return item.children.some((c) => childActive(pathname, c));
}

function NavLink({
  item,
  pathname,
  onNavigate,
  variant = "main",
}: {
  item: NavItemConfig;
  pathname: string;
  onNavigate?: () => void;
  variant?: "main" | "child";
}) {
  const active =
    variant === "child" ? childActive(pathname, item) : pathActive(pathname, item);
  return (
    <Link
      href={item.href}
      className={`ds-side__link${
        variant === "child" ? " ds-side__link--child" : " ds-side__link--main"
      }${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {item.icon ? (
        <span className="ds-side__icon" aria-hidden>
          {item.icon}
        </span>
      ) : null}
      <span className="ds-side__label">{item.label}</span>
      {item.badge != null && item.badge !== "" ? (
        <span className="ds-side__badge">{item.badge}</span>
      ) : null}
    </Link>
  );
}

export function Sidebar({
  brand,
  account,
  accounts,
  onAccountChange,
  groups,
  footer,
  helpHref = "/legal/mentions",
  helpLabel = "Aide / Support",
  open = true,
  onClose,
  mobile = false,
}: {
  brand?: ReactNode;
  account?: AccountOption | null;
  accounts?: AccountOption[];
  onAccountChange?: (id: string) => void;
  groups: NavGroupConfig[];
  footer?: ReactNode;
  helpHref?: string;
  helpLabel?: string;
  open?: boolean;
  onClose?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname() || "/";

  const body = (
    <aside
      className={`ds-side${mobile ? " ds-side--drawer" : ""}${
        open ? " is-open" : ""
      }`}
      aria-label="Navigation principale"
    >
      <div className="ds-side__top">
        {brand ? <div className="ds-side__brand">{brand}</div> : null}
        {account ? (
          <div className="ds-side__account">
            {accounts && accounts.length > 1 && onAccountChange ? (
              <label className="ds-side__account-select">
                <span className="sr-only">Compte</span>
                <select
                  value={account.id}
                  onChange={(e) => onAccountChange(e.target.value)}
                  aria-label="Changer de compte"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div>
                <p className="ds-side__account-name">{account.name}</p>
                {account.subtitle ? (
                  <p className="ds-side__account-sub">{account.subtitle}</p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <nav className="ds-side__nav">
        {groups.map((group) => (
          <div key={group.id} className="ds-side__group">
            {group.label ? (
              <p className="ds-side__group-label">{group.label}</p>
            ) : null}
            <ul className="ds-side__list" role="list">
              {group.items.map((item) => {
                const expanded = sectionExpanded(pathname, item);
                return (
                  <li key={item.id} className={expanded ? "is-expanded" : undefined}>
                    <NavLink
                      item={item}
                      pathname={pathname}
                      onNavigate={mobile ? onClose : undefined}
                      variant="main"
                    />
                    {expanded && item.children?.length ? (
                      <ul className="ds-side__sublist" role="list">
                        {item.children.map((child) => (
                          <li key={child.id}>
                            <NavLink
                              item={child}
                              pathname={pathname}
                              onNavigate={mobile ? onClose : undefined}
                              variant="child"
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="ds-side__bottom">
        <Link
          href={helpHref}
          className="ds-side__help"
          onClick={mobile ? onClose : undefined}
        >
          {helpLabel}
        </Link>
        {footer}
      </div>
    </aside>
  );

  if (!mobile) return body;

  return (
    <div
      className={`ds-side-overlay${open ? " is-open" : ""}`}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {body}
    </div>
  );
}
