"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type StoreOpt = { id: string; name: string };

const NETWORK_LINKS = [
  { href: "/franchise", label: "Réseau", exact: true },
  { href: "/franchise/stores", label: "Boutiques" },
] as const;

export function FranchiseNav({
  activeStoreId,
  stores,
}: {
  activeStoreId: string;
  stores: StoreOpt[];
}) {
  const pathname = usePathname();
  const base = `/franchise/s/${activeStoreId}`;
  const opsLinks = [
    { href: `${base}/stock`, label: "Stock" },
    { href: `${base}/orders`, label: "Courses" },
    { href: `${base}/kiosks`, label: "Caisse" },
    { href: `${base}/team`, label: "Équipe" },
    { href: `${base}/settings`, label: "Réglages" },
  ];

  return (
    <div className="franchise-nav-stack">
      <nav className="franchise__navlinks" aria-label="Réseau Franchise">
        {NETWORK_LINKS.map(({ href, label, ...rest }) => {
          const exact = "exact" in rest && rest.exact;
          const active = exact
            ? pathname === href
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? "franchise__navlink franchise__navlink--active"
                  : "franchise__navlink"
              }
              aria-current={active ? "page" : undefined}
            >
              <span className="franchise__navlink-mark" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      {stores.length > 0 ? (
        <div className="franchise-store-switch">
          <p className="franchise-store-switch__label">Boutique active</p>
          <ul className="franchise-store-switch__list">
            {stores.map((s) => {
              const active = s.id === activeStoreId;
              return (
                <li key={s.id}>
                  <Link
                    href={`/franchise/s/${s.id}/stock`}
                    className={
                      active
                        ? "franchise-store-chip franchise-store-chip--active"
                        : "franchise-store-chip"
                    }
                  >
                    {s.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <nav className="franchise__navlinks" aria-label="Ops boutique">
        {opsLinks.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? "franchise__navlink franchise__navlink--active"
                  : "franchise__navlink"
              }
              aria-current={active ? "page" : undefined}
            >
              <span className="franchise__navlink-mark" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
