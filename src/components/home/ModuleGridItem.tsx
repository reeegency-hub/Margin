import Link from "next/link";
import type { ReactNode } from "react";

export function ModuleGridItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[88px] flex-col items-center justify-center gap-2.5 transition active:scale-[0.96]"
    >
      <span className="home-module-circle flex h-14 w-14 items-center justify-center rounded-full text-[var(--text-primary-dark)]">
        {icon}
      </span>
      <span className="home-muted text-center text-[13px] font-medium">{label}</span>
    </Link>
  );
}
