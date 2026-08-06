import Link from "next/link";
import { IconAlert } from "./icons";
import type { HomeAlert } from "./types";
import { validateOrderAction } from "@/app/actions";

export function AlertCard({ alert }: { alert: NonNullable<HomeAlert> }) {
  return (
    <section className="home-alert mt-5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <IconAlert className="h-5 w-5" color="var(--accent-lime)" />
        <p className="text-[15px] font-semibold text-[var(--text-primary-dark)]">
          {alert.badgeLabel}
        </p>
      </div>

      <p className="text-[20px] font-semibold leading-snug text-[var(--text-primary-dark)]">
        {alert.message}
      </p>

      {alert.orderId ? (
        <form action={validateOrderAction} className="mt-5">
          <input type="hidden" name="id" value={alert.orderId} />
          <button type="submit" className="home-cta flex w-full items-center justify-center px-4 text-[17px]">
            {alert.ctaLabel}
          </button>
        </form>
      ) : (
        <Link
          href={alert.ctaHref || "/orders"}
          className="home-cta mt-5 flex w-full items-center justify-center px-4 text-[17px]"
        >
          {alert.ctaLabel}
        </Link>
      )}
    </section>
  );
}
