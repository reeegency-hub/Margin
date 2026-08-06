import type { ReactNode, ButtonHTMLAttributes } from "react";
import Link from "next/link";

export function PillButton({
  children,
  href,
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "ghost" | "soft";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `pill-btn pill-btn--${variant} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
