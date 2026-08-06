"use client";

import { useId, useMemo } from "react";
import { OnboardingSection } from "./OnboardingSection";
import { OnboardingStepModal } from "./OnboardingStepModal";
import type { OnboardingSectionView, OnboardingTaskView } from "./types";

export function OnboardingWidget({
  title = "Guide de démarrage",
  sections,
  collapsed,
  onToggleCollapsed,
  nextTask,
  onOpenTask,
  activeTask,
  onCloseTask,
  onContinueTask,
  hidden = false,
  className = "",
}: {
  title?: string;
  sections: OnboardingSectionView[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  nextTask: OnboardingTaskView | null;
  onOpenTask: (taskId: string) => void;
  activeTask: OnboardingTaskView | null;
  onCloseTask: () => void;
  /** Marque done + éventuelle navigation (gérée par le parent) */
  onContinueTask: (task: OnboardingTaskView) => void;
  hidden?: boolean;
  className?: string;
}) {
  const panelId = useId();

  const flatTasks = useMemo(
    () => sections.flatMap((s) => s.tasks),
    [sections]
  );

  if (hidden) return null;

  return (
    <>
      <aside
        className={`ob-widget ${collapsed ? "ob-widget--collapsed" : "ob-widget--expanded"} ${className}`}
        aria-label={title}
      >
        <div className="ob-widget__segments" aria-hidden>
          {sections.map((section) => (
            <div key={section.id} className="ob-widget__segment" title={section.title}>
              <i style={{ width: `${Math.round(section.progress * 100)}%` }} />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="ob-widget__header"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls={panelId}
        >
          <span className="ob-widget__title">{title}</span>
          <span className="ob-widget__chevron" aria-hidden>
            {collapsed ? "⌃" : "⌄"}
          </span>
        </button>

        {collapsed ? (
          nextTask ? (
            <button
              type="button"
              className="ob-widget__next"
              onClick={() => onOpenTask(nextTask.id)}
            >
              Étape suivante :{" "}
              <span className="ob-widget__next-action">{nextTask.label}</span>
            </button>
          ) : (
            <p className="ob-widget__done-msg">Tout est fait. Beau travail.</p>
          )
        ) : (
          <div id={panelId} className="ob-widget__body">
            {sections.map((section) => (
              <OnboardingSection
                key={section.id}
                title={section.title}
                tasks={section.tasks}
                onSelectTask={onOpenTask}
              />
            ))}
          </div>
        )}
      </aside>

      <OnboardingStepModal
        open={Boolean(activeTask)}
        onClose={onCloseTask}
        onContinue={() => {
          if (activeTask) onContinueTask(activeTask);
        }}
        title={activeTask?.title || activeTask?.label || ""}
        description={activeTask?.description}
        illustration={activeTask?.illustration}
        continueLabel={activeTask?.continueLabel || "Continuer"}
        progress={
          flatTasks.length === 0
            ? 1
            : flatTasks.filter((t) => t.status === "done").length /
              flatTasks.length
        }
        sectionTitle={activeTask?.sectionTitle}
        incentives={activeTask?.incentives || []}
      />
    </>
  );
}
