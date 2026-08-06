"use client";

import type { ReactNode } from "react";
import { OnboardingItem } from "./OnboardingItem";
import type { OnboardingTaskView } from "./types";

export function OnboardingSection({
  title,
  tasks,
  onSelectTask,
  children,
}: {
  title: string;
  tasks?: OnboardingTaskView[];
  onSelectTask?: (taskId: string) => void;
  /** Alternative : passer des OnboardingItem en enfants */
  children?: ReactNode;
}) {
  return (
    <section className="ob-section">
      <h3 className="ob-section__title">{title}</h3>
      {children ? (
        <ul className="ob-section__list" role="list">
          {children}
        </ul>
      ) : (
        <ul className="ob-section__list" role="list">
          {(tasks ?? []).map((task) => (
            <li key={task.id} role="listitem">
              <OnboardingItem
                status={task.status}
                label={task.label}
                onClick={
                  task.status === "todo"
                    ? () => onSelectTask?.(task.id)
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
