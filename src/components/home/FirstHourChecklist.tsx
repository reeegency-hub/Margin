"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getFirstHourPageContext,
  pickSectionGuide,
  type FirstHourItem,
  type FirstHourState,
  type GuideBundle,
} from "@/lib/first-hour";

export type { FirstHourItem };
export { isFirstHourWindow } from "@/lib/first-hour";

/**
 * Parcours singulier par page menu (Stock / Courses / Équipe / Commerce / Accueil).
 * Accueil = checklist complète avec tous les CTAs cliquables.
 */
export function FirstHourChecklist({
  items,
  lead,
  variant = "hero",
  bundle,
}: {
  items?: FirstHourItem[];
  lead?: string;
  variant?: "hero" | "page";
  bundle?: GuideBundle | null;
}) {
  const pathname = usePathname() || "/";

  const guide = bundle
    ? pickSectionGuide(bundle, pathname)
    : items
      ? {
          section: "home" as const,
          badge: "Votre démarrage",
          title: "Chemin commerce",
          lead: lead || "",
          items,
          active: items.some((i) => !i.done),
        }
      : null;

  if (!guide || !guide.active) return null;

  const ctx = getFirstHourPageContext(guide);
  const doneCount = guide.items.filter((i) => i.done).length;
  const openItems = guide.items.filter((i) => !i.done);
  const progress = (doneCount / guide.items.length) * 100;
  const isHome = pathname === "/" || guide.section === "home";
  const mode = variant === "page" && !isHome ? "page" : "hero";

  return (
    <div className="first-hour-slot">
      <section
        className={`first-hour first-hour--hero${
          mode === "page" ? " first-hour--page" : ""
        }${isHome ? " first-hour--home" : ""}`}
        aria-label={guide.title}
        data-menu={guide.badge}
      >
      <div className="first-hour__badge">{ctx.badge}</div>
      <div className="first-hour__head">
        <h2>{ctx.title}</h2>
        <span>
          {doneCount}/{guide.items.length}
        </span>
      </div>
      <p className="first-hour__lead">{ctx.lead}</p>

      <div className="first-hour__track" aria-hidden>
        <i style={{ width: `${Math.max(8, progress)}%` }} />
      </div>

        {!isHome ? (
      <ol className="first-hour__path" aria-label="Progression">
        {guide.items.map((item, index) => {
          const state = item.done
            ? "is-done"
            : index === ctx.focusIndex
              ? "is-active"
              : "is-todo";
          return (
            <li key={item.id} className={`first-hour__path-node ${state}`}>
              <span className="first-hour__path-dot">
                {item.done ? "✓" : index + 1}
              </span>
              <span className="first-hour__path-label">{item.label}</span>
            </li>
          );
        })}
      </ol>
        ) : null}

      <Link href={ctx.focus.href} className="first-hour__next">
        <span className="first-hour__next-label">
            {isHome
              ? `Prochaine action · ${doneCount}/${guide.items.length}`
              : `Étape ${ctx.focusIndex + 1}/${guide.items.length} — maintenant`}
        </span>
        <strong>{ctx.focus.label}</strong>
        {ctx.focus.hint ? (
          <span className="first-hour__next-hint">{ctx.focus.hint}</span>
        ) : null}
        <span className="first-hour__next-cta">{ctx.focus.cta} →</span>
      </Link>

        {isHome ? (
          <ol className="first-hour__actions" aria-label="Toutes les actions">
            {guide.items.map((item) => (
              <li
                key={item.id}
                className={`first-hour__action ${
                  item.done ? "is-done" : "is-open"
                }`}
              >
                <div className="first-hour__action-text">
                  <strong>{item.label}</strong>
                  {item.hint && !item.done ? <p>{item.hint}</p> : null}
                </div>
                {item.done ? (
                  <span className="first-hour__ok">Fait</span>
                ) : (
                  <Link href={item.href} className="first-hour__cta">
                    {item.cta}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <>
            {openItems.length > 1 ? (
        <p className="first-hour__upcoming">
                Ensuite :{" "}
                {openItems
                  .slice(1)
                  .map((u) => u.label)
                  .join(" → ")}
        </p>
      ) : (
              <p className="first-hour__upcoming">
                Dernière étape de ce parcours.
              </p>
      )}

      {mode === "hero" ? (
        <ol className="first-hour__list">
          {guide.items.map((item, index) => (
            <li
              key={item.id}
              className={`first-hour__item ${
                item.done
                  ? "is-done"
                  : index === ctx.focusIndex
                    ? "is-current"
                    : "is-todo"
              }`}
            >
              <span className="first-hour__num" aria-hidden>
                {item.done ? "✓" : index + 1}
              </span>
              <div className="first-hour__body">
                <strong>{item.label}</strong>
                {item.hint && !item.done ? (
                  <p className="first-hour__hint">{item.hint}</p>
                ) : null}
                {!item.done ? (
                  index === ctx.focusIndex ? (
                    <Link href={item.href} className="first-hour__cta">
                      {item.cta}
                    </Link>
                  ) : (
                    <span className="first-hour__soon">À venir</span>
                  )
                ) : (
                  <span className="first-hour__ok">Fait</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
          </>
        )}
    </section>
    </div>
  );
}

export function FirstHourFromState({
  state,
  variant = "page",
}: {
  state: FirstHourState;
  variant?: "hero" | "page";
}) {
  return <FirstHourChecklist bundle={state.bundle} variant={variant} />;
}
