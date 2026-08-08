"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  OnboardingStepModal,
  useOnboarding,
  type OnboardingSectionConfig,
  type OnboardingTaskView,
} from "@/components/onboarding";
import type { FirstHourState, GuideBundle, SectionGuide } from "@/lib/first-hour";
import {
  hrefWithGuide,
  pathFromHref,
  writeGuideFocus,
} from "@/components/home/guide-focus";

const SECTION_ORDER: (keyof GuideBundle)[] = [
  "magasin",
  "courses",
  "stock",
  "equipe",
  "couts",
];

const SECTION_META: Record<
  string,
  { outcome: string; minutes: number }
> = {
  magasin: {
    outcome: "Caisse branchée — les ventes mettent le stock à jour.",
    minutes: 8,
  },
  courses: {
    outcome: "Premier réassort test — liste → fait → stock à jour.",
    minutes: 5,
  },
  stock: {
    outcome: "Fini les ruptures surprises — vous savez ce qu’il reste.",
    minutes: 12,
  },
  equipe: {
    outcome: "Qui est là, qui pointe — le quotidien sans friction.",
    minutes: 6,
  },
  couts: {
    outcome: "Hausses & négociation — votre marge sous contrôle.",
    minutes: 10,
  },
};

function SectionIcon({ id }: { id: string }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    "aria-hidden": true as const,
  };
  if (id === "magasin") {
    return (
      <svg {...props}>
        <path d="M4 10h16v10H4z" />
        <path d="M3 10l2-5h14l2 5" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }
  if (id === "stock") {
    return (
      <svg {...props}>
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 7v10l9 4 9-4V7" />
        <path d="M12 11v10" />
      </svg>
    );
  }
  if (id === "equipe") {
    return (
      <svg {...props}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M2.5 20c0-4 3-6.5 6.5-6.5S15.5 16 15.5 20" />
        <circle cx="17.5" cy="8.5" r="2.6" />
        <path d="M15.5 13.4c2.8.4 4.8 2.6 4.8 6.1" />
      </svg>
    );
  }
  if (id === "courses") {
    return (
      <svg {...props}>
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="17" cy="20" r="1.4" />
        <path d="M3 4h2l2.4 11h10.2L20 8H7" />
      </svg>
    );
  }
  if (id === "couts") {
    return (
      <svg {...props}>
        <path d="M18 6a7 7 0 100 12" />
        <path d="M5 10h10M5 14h8" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

function incentivesFor(
  itemId: string,
  hint: string | undefined,
  sectionTitle: string
): string[] {
  const byId: Record<string, string[]> = {
    "stock-products": [
      "Ajoutez au moins un produit (nom + quantité).",
      "Vérifiez l’unité (kg, pièce, litre…).",
    ],
    "stock-import": [
      "Collez ou importez votre liste / catalogue.",
      "Contrôlez les lignes proposées puis validez.",
    ],
    "stock-count": [
      "Lancez une vérification sur le rayon.",
      "Corrigez les quantités réelles, puis validez.",
    ],
    "courses-list": [
      "Créez une liste à partir des besoins (stock bas).",
      "Sans besoins, le bouton Créer actualise quand même.",
    ],
    "courses-do": [
      "Achetez selon la liste.",
      "Marquez comme fait — le stock se réintègre automatiquement.",
    ],
    "cost-invoice": [
      "Importez le CSV, PDF ou photo — pas de saisie ligne à ligne.",
      "Corrigez qty, prix et match, puis validez.",
    ],
    "cost-hikes": [
      "Ouvrez la section Hausses.",
      "Les hausses ≥ 5 % apparaissent après import de factures.",
    ],
    "cost-negotiate": [
      "Ouvrez le comparatif fournisseurs.",
      "Une fois par mois suffit.",
    ],
    "cost-food": [
      "Le coût matière demande factures + ventes + fiches produit.",
      "Repérez ce qui a monté aujourd’hui.",
    ],
    "team-members": [
      "Ajoutez le prénom d’une personne de l’équipe.",
      "Répétez pour chaque personne du commerce.",
    ],
    "team-planning": [
      "Créez un créneau sur le planning.",
      "Assignez qui travaille aujourd’hui / demain.",
    ],
    "team-clock": [
      "Pointez Présent ou Absent pour quelqu’un.",
      "Faites-le chaque matin — un geste suffit.",
    ],
    "shop-pos": [
      "Indiquez votre logiciel de caisse.",
      "Suivez les étapes pour brancher la synchro.",
    ],
    "shop-delivery": [
      "Ajoutez Uber / Deliveroo seulement si vous livrez.",
      "Sinon ignorez — ce n’est pas bloquant.",
    ],
    "shop-settings": [
      "Ajoutez le numéro WhatsApp du commerce.",
      "Enregistrez pour recevoir alertes et listes.",
    ],
  };
  return (
    byId[itemId] || [
      hint || `Faites l’action sur la page ${sectionTitle}.`,
      "Quand c’est fait, l’étape se coche toute seule.",
    ]
  );
}

function guideToSections(bundle: GuideBundle): OnboardingSectionConfig[] {
  return SECTION_ORDER.map((key) => {
    const guide: SectionGuide = bundle[key];
    const sectionTitle =
      guide.title.replace(/^Parcours\s+/i, "") || guide.badge;
    return {
      id: guide.section,
      title: sectionTitle,
      tasks: guide.items.map((item) => ({
        id: item.id,
        label: item.label,
        title: item.label,
        sectionTitle,
        hint: item.hint,
        optional: Boolean(
          item.optional ||
            /optionnel/i.test(item.label) ||
            /optionnel/i.test(item.hint || "")
        ),
        description: item.hint ? (
          <p>
            <strong>Pourquoi c’est important :</strong> {item.hint}
          </p>
        ) : undefined,
        continueLabel: item.cta
          ? `Aller faire : ${item.cta}`
          : `Aller à ${item.label}`,
        href: item.href,
        incentives: incentivesFor(item.id, item.hint, sectionTitle),
      })),
    };
  }).filter((s) => s.tasks.length > 0);
}

function completedFromBundle(bundle: GuideBundle): string[] {
  return SECTION_ORDER.flatMap((key) =>
    bundle[key].items.filter((i) => i.done).map((i) => i.id)
  );
}

function ProgressRing({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <div
      className="sg-ring"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct} %`}
    >
      <svg viewBox="0 0 100 100" width="96" height="96" aria-hidden>
        <circle className="sg-ring__track" cx="50" cy="50" r={r} />
        <circle
          className="sg-ring__val"
          cx="50"
          cy="50"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="sg-ring__label">
        <strong>{pct}%</strong>
      </div>
    </div>
  );
}

/**
 * Guide de démarrage plein écran (Accueil) + dock ailleurs.
 * Objectif : le commerçant suit le parcours jusqu’à un commerce opérationnel.
 */
export function FirstHourGuide({
  state,
  restaurantId,
  hidden = false,
  mode = "auto",
  onMinimize,
  onExpand,
}: {
  state: FirstHourState;
  restaurantId?: string;
  hidden?: boolean;
  /** fullscreen = Accueil ; dock = barre bas ; auto selon pathname */
  mode?: "auto" | "fullscreen" | "dock";
  onMinimize?: () => void;
  onExpand?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const bundle = state.bundle;

  const resolvedMode =
    mode === "auto" ? (pathname === "/" ? "fullscreen" : "dock") : mode;

  const sections = useMemo(() => guideToSections(bundle), [bundle]);
  const initialCompletedIds = useMemo(
    () => completedFromBundle(bundle),
    [bundle]
  );

  const storageKey = `margin:guide:${restaurantId || "shop"}`;

  const onboarding = useOnboarding({
    storageKey,
    sections,
    initialCompletedIds,
    defaultCollapsed: resolvedMode === "dock",
    lockMode: "none",
  });

  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const dockStorageKey = `margin:guide-dock-open:${restaurantId || "shop"}`;
  const [dockOpen, setDockOpen] = useState(true);

  useEffect(() => {
    if (resolvedMode !== "dock") return;
    try {
      const raw = localStorage.getItem(dockStorageKey);
      if (raw === "0") setDockOpen(false);
      if (raw === "1") setDockOpen(true);
    } catch {
      /* ignore */
    }
  }, [dockStorageKey, resolvedMode]);

  useEffect(() => {
    if (resolvedMode !== "dock") return;
    try {
      localStorage.setItem(dockStorageKey, dockOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle(
      "ms-guide-dock-open",
      dockOpen
    );
    document.documentElement.classList.toggle(
      "ms-guide-dock-hidden",
      !dockOpen
    );
    return () => {
      document.documentElement.classList.remove(
        "ms-guide-dock-open",
        "ms-guide-dock-hidden"
      );
    };
  }, [dockOpen, dockStorageKey, resolvedMode]);

  useEffect(() => {
    if (!onboarding.nextTask) return;
    const parent = onboarding.sections.find((s) =>
      s.tasks.some((t) => t.id === onboarding.nextTask!.id)
    );
    if (parent) setOpenSectionId(parent.id);
  }, [onboarding.nextTask?.id, onboarding.sections]);

  const startTask = (task: OnboardingTaskView) => {
    if (!task.href) return;
    writeGuideFocus({
      id: task.id,
      label: task.label,
      hint: task.hint,
      cta: task.continueLabel || task.label,
      href: task.href,
      path: pathFromHref(task.href),
      sectionTitle: task.sectionTitle,
      incentives: task.incentives || [],
    });
    onboarding.closeTask();
    router.push(hrefWithGuide(task.href, task.id));
  };

  if (hidden || onboarding.dismissed) return null;
  // Parcours terminé côté serveur → le dock disparaît tout seul
  if (!state.active && resolvedMode === "dock") return null;

  const next = onboarding.nextTask;
  const progress =
    onboarding.totalTasks === 0
      ? 1
      : onboarding.totalDone / onboarding.totalTasks;
  const onCaisse = pathname.startsWith("/kiosks");
  const hrefIsCaisse = (href?: string | null) =>
    Boolean(href && (href === "/kiosks" || href.startsWith("/kiosks?")));
  const nextIsCaisse = hrefIsCaisse(next?.href);
  const activeIsCaisse = hrefIsCaisse(onboarding.activeTask?.href);

  const modal = (
    <OnboardingStepModal
      open={Boolean(onboarding.activeTask) && !(onCaisse && activeIsCaisse)}
      onClose={onboarding.closeTask}
      onContinue={() => {
        if (onboarding.activeTask) startTask(onboarding.activeTask);
      }}
      onSkip={() => {
        const t = onboarding.activeTask;
        if (!t?.optional) return;
        onboarding.markDone(t.id);
        onboarding.closeTask();
      }}
      optional={Boolean(onboarding.activeTask?.optional)}
      skipLabel="Passer"
      title={onboarding.activeTask?.title || onboarding.activeTask?.label || ""}
      description={onboarding.activeTask?.description}
      continueLabel={onboarding.activeTask?.continueLabel || "Continuer"}
      progress={
        onboarding.totalTasks === 0
          ? 1
          : onboarding.totalDone / onboarding.totalTasks
      }
      sectionTitle={onboarding.activeTask?.sectionTitle}
      incentives={onboarding.activeTask?.incentives || []}
    />
  );

  /* Dock = nuage en bas, flèche pour afficher / masquer */
  if (resolvedMode === "dock") {
    return (
      <>
        <div
          className={`sg-dock-float${dockOpen ? " is-open" : " is-hidden"}`}
        >
          {dockOpen ? (
            <aside
              className="sg-dock sg-dock--bottom"
              aria-label="Guide de démarrage"
              data-tour="home-dock"
            >
              <button
                type="button"
                className="sg-dock__chevron"
                aria-label="Masquer le guide"
                title="Masquer"
                onClick={() => setDockOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <div className="sg-dock__panel">
                <div
                  className="sg-dock__track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                  aria-label="Progression du guide"
                >
                  <i style={{ width: `${Math.max(4, progress * 100)}%` }} />
                </div>
                <div className="sg-dock__bar">
                  <button
                    type="button"
                    className="sg-dock__expand"
                    onClick={() => {
                      onExpand?.();
                      if (pathname !== "/") router.push("/");
                    }}
                  >
                    <span className="sg-dock__eyebrow">Guide</span>
                    <span className="sg-dock__title">
                      {next ? next.label : "Commerce prêt"}
                    </span>
                  </button>
                  {next && !(onCaisse && nextIsCaisse) ? (
                    <button
                      type="button"
                      className="sg-dock__cta"
                      onClick={() => onboarding.openTask(next.id)}
                    >
                      Continuer
                      <span aria-hidden> →</span>
                    </button>
                  ) : next && onCaisse && nextIsCaisse ? (
                    <p className="sg-dock__done">Caisse ci-dessus</p>
                  ) : (
                    <p className="sg-dock__done">Terminé</p>
                  )}
                </div>
              </div>
            </aside>
          ) : (
            <button
              type="button"
              className="sg-dock__peek"
              aria-label="Afficher le guide"
              title="Afficher le guide"
              onClick={() => setDockOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M18 15l-6-6-6 6" />
              </svg>
              <span>Guide</span>
            </button>
          )}
        </div>
        {modal}
      </>
    );
  }

  /* ——— FULLSCREEN (Accueil) ——— */
  return (
    <>
      <section className="sg-full" aria-label="Guide de démarrage">
        <header className="sg-full__hero">
          <div className="sg-full__hero-copy">
            <p className="sg-full__eyebrow">Mise en route commerce</p>
            <h1 className="sg-full__title">
              Configurez Margin une fois.
              <span> Ensuite, le commerce tourne tout seul.</span>
            </h1>
            <p className="sg-full__lead">
              Stock, équipe, courses, coûts, caisse — et le{" "}
              <strong>Copilote</strong> à droite pour vous guider. Chaque étape
              coche une vraie pièce de votre quotidien.
            </p>
            <ul className="sg-full__promises">
              <li>Alertes WhatsApp quand ça casse</li>
              <li>Listes de courses depuis le stock bas</li>
              <li>Hausses fournisseurs & pertes en €</li>
            </ul>
          </div>
          <div className="sg-full__hero-aside">
            <ProgressRing value={progress} />
          </div>
        </header>

        <aside className="sg-full__copilot ms-spot__card" aria-label="Copilote Margin">
          <div className="sg-full__copilot-copy">
            <p className="ms-spot__eyebrow">Produit à part entière</p>
            <h2 className="ms-spot__title">Copilote Margin</h2>
            <p className="ms-spot__lead">
              Toujours ouvert à droite : il configure le commerce (inventaire,
              équipe, WhatsApp), lit vos CSV/PDF, et répond sur stock, courses et
              coûts — avec aperçu avant toute écriture. Pas un gadget : c’est le
              fil conducteur du produit.
            </p>
          </div>
          <button
            type="button"
            className="sg-full__copilot-cta"
            onClick={() => {
              window.dispatchEvent(new Event("margin:open-assistant"));
            }}
          >
            Voir le Copilote →
          </button>
        </aside>

        {next ? (
          <div className="sg-full__next">
            <div className="sg-full__next-copy">
              <p className="sg-full__next-kicker">À faire maintenant</p>
              <h2>{next.label}</h2>
              {next.hint ? <p>{next.hint}</p> : null}
              {next.sectionTitle ? (
                <p className="sg-full__next-sec">
                  Dans : {next.sectionTitle}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="sg-full__next-cta"
              onClick={() => onboarding.openTask(next.id)}
            >
              {next.continueLabel || "Commencer"}
            </button>
          </div>
        ) : (
          <div className="sg-full__celebrate">
            <h2>Votre commerce est prêt.</h2>
            <p>
              Margin peut maintenant alerter, lister, pointer et suivre les
              coûts. Revenez ici seulement pour affiner.
            </p>
            <button
              type="button"
              className="sg-full__next-cta"
              onClick={() => {
                onboarding.dismiss();
                onMinimize?.();
              }}
            >
              Entrer dans le tableau de bord
            </button>
          </div>
        )}

        <div className="sg-full__grid">
          {onboarding.sections.map((section, index) => {
            const meta = SECTION_META[section.id];
            const open = openSectionId === section.id || (!openSectionId && index === 0 && section.progress < 1);
            const isCurrent = next
              ? section.tasks.some((t) => t.id === next.id)
              : false;
            return (
              <article
                key={section.id}
                className={`sg-card${section.progress >= 1 ? " is-done" : ""}${
                  isCurrent ? " is-current" : ""
                }`}
              >
                <button
                  type="button"
                  className="sg-card__head"
                  onClick={() =>
                    setOpenSectionId(
                      openSectionId === section.id ? null : section.id
                    )
                  }
                >
                  <span className="sg-card__icon" aria-hidden>
                    <SectionIcon id={section.id} />
                  </span>
                  <div className="sg-card__titles">
                    <h3>{section.title}</h3>
                    <p>{meta?.outcome}</p>
                  </div>
                  <div className="sg-card__stat" aria-hidden>
                    {section.progress >= 1 ? (
                      <strong className="sg-card__check">✓</strong>
                    ) : (
                      <span className="sg-card__dots">
                        {Array.from({ length: section.totalCount }).map(
                          (_, i) => (
                            <i
                              key={i}
                              className={
                                i < section.doneCount ? "is-on" : undefined
                              }
                            />
                          )
                        )}
                      </span>
                    )}
                  </div>
                </button>
                <div className="sg-card__track" aria-hidden>
                  <i style={{ width: `${Math.round(section.progress * 100)}%` }} />
                </div>
                {(open || isCurrent) && (
                  <ul className="sg-card__tasks">
                    {section.tasks.map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          className={`sg-task sg-task--${task.status}`}
                          disabled={task.status === "done"}
                          onClick={() =>
                            task.status === "todo"
                              ? onboarding.openTask(task.id)
                              : undefined
                          }
                        >
                          <span className="sg-task__mark" aria-hidden>
                            {task.status === "done" ? "✓" : "○"}
                          </span>
                          <span className="sg-task__body">
                            <span className="sg-task__label">{task.label}</span>
                            {task.hint && task.status !== "done" ? (
                              <span className="sg-task__hint">{task.hint}</span>
                            ) : null}
                          </span>
                          {task.status === "todo" ? (
                            <span className="sg-task__go">Faire →</span>
                          ) : task.status === "done" ? (
                            <span className="sg-task__ok">Fait</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>

        <footer className="sg-full__foot">
          <p>
            Astuce : le <strong>Copilote</strong> reste à droite pendant tout le
            parcours — posez-lui une question ou joignez un fichier. Chaque CTA
            du guide vous emmène sur la bonne page ; l’étape se valide dès que
            c’est fait.
          </p>
          {next ? (
            <button
              type="button"
              className="sg-full__soft"
              onClick={() => {
                onboarding.setCollapsed(true);
                onMinimize?.();
              }}
            >
              Continuer plus tard (le guide reste en bas)
            </button>
          ) : null}
        </footer>
      </section>
      {modal}
    </>
  );
}
