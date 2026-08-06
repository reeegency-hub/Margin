import Link from "next/link";
import { FOCUS_ID_TO_GUIDE_ACTION } from "@/lib/guide-anchors";

export type FocusCadence = "day" | "week" | "month";

export type DayFocusItem = {
  id: string;
  cadence: FocusCadence;
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  urgency?: "high" | "normal";
  done?: boolean;
  orderId?: string;
};

/** @deprecated use DayFocusItem — conservé pour MobileHome legacy */
export type DayFocusData = DayFocusItem;

const CADENCE_LABEL: Record<FocusCadence, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
};

function guideActionFor(focusId: string): string | undefined {
  return FOCUS_ID_TO_GUIDE_ACTION[focusId];
}

/**
 * Liste des focus à traiter — même structure visuelle partout (Accueil + hubs).
 */
export function DayFocus({
  focuses,
  focus,
  eyebrow = "À gérer · jour & semaine",
  ariaLabel = "Focus à gérer",
}: {
  focuses?: DayFocusItem[];
  /** Legacy : un seul focus */
  focus?: DayFocusItem;
  eyebrow?: string;
  ariaLabel?: string;
}) {
  const list =
    focuses && focuses.length > 0 ? focuses : focus ? [focus] : [];
  if (list.length === 0) return null;

  const [primary, ...rest] = list;
  const openCount = list.filter((f) => !f.done).length;
  const primaryAction = guideActionFor(primary!.id);

  return (
    <section
      className="day-focus day-focus--list"
      aria-label={ariaLabel}
      data-tour="home-focus"
    >
      <div className="day-focus__head-row">
        <p className="day-focus__eyebrow">{eyebrow}</p>
        <span className="day-focus__count">
          {openCount} priorité{openCount > 1 ? "s" : ""}
        </span>
      </div>

      <article
        className={`day-focus__primary${
          primary!.urgency === "high" && !primary!.done ? " is-urgent" : ""
        }${primary!.done ? " is-done" : ""}`}
      >
        <div className="day-focus__badges">
          <span
            className={`day-focus__cadence day-focus__cadence--${primary!.cadence}`}
          >
            {CADENCE_LABEL[primary!.cadence]}
          </span>
          {primary!.urgency === "high" && !primary!.done ? (
            <span className="day-focus__urgent">Urgent</span>
          ) : null}
        </div>
        <h2 className="day-focus__title">{primary!.title}</h2>
        <p className="day-focus__message">{primary!.message}</p>
        {!primary!.done ? (
          <Link
            href={primary!.ctaHref}
            className="day-focus__cta"
            {...(primaryAction
              ? { "data-guide-action": primaryAction }
              : {})}
          >
            {primary!.ctaLabel}
            <span aria-hidden> →</span>
          </Link>
        ) : null}
      </article>

      {rest.length > 0 ? (
        <ul className="day-focus__queue" aria-label="Autres focus">
          {rest.map((item) => {
            const action = guideActionFor(item.id);
            return (
              <li key={item.id}>
                <Link
                  href={item.ctaHref}
                  className={`day-focus__row${item.done ? " is-done" : ""}${
                    item.urgency === "high" ? " is-urgent" : ""
                  }`}
                  {...(action ? { "data-guide-action": action } : {})}
                >
                  <span
                    className={`day-focus__cadence day-focus__cadence--${item.cadence}`}
                  >
                    {CADENCE_LABEL[item.cadence]}
                  </span>
                  <span className="day-focus__row-body">
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                  </span>
                  <span className="day-focus__row-cta">{item.ctaLabel} →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
