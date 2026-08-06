import type { ReactNode } from "react";

export type OnboardingItemStatus = "done" | "todo" | "locked";

export type OnboardingTaskConfig = {
  id: string;
  label: string;
  /** Contenu de la modale d’étape */
  title?: string;
  description?: ReactNode;
  /** CTA primaire de la modale */
  continueLabel?: string;
  /** Lien / action après « Continuer » */
  href?: string;
  illustration?: ReactNode;
  /** Section parente (ex. Stock) — pour le kicker de modale */
  sectionTitle?: string;
  /** Texte d’aide court */
  hint?: string;
  /** Gestes à suivre une fois sur la page */
  incentives?: string[];
  /** Affiche « Passer » — n’est pas bloquant */
  optional?: boolean;
};

export type OnboardingSectionConfig = {
  id: string;
  title: string;
  tasks: OnboardingTaskConfig[];
};

export type OnboardingTaskView = OnboardingTaskConfig & {
  status: OnboardingItemStatus;
};

export type OnboardingSectionView = {
  id: string;
  title: string;
  tasks: OnboardingTaskView[];
  /** 0–1 */
  progress: number;
  doneCount: number;
  totalCount: number;
};

export type OnboardingPersistState = {
  completedIds: string[];
  collapsed: boolean;
  dismissed?: boolean;
};
