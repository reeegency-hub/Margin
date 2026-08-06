import type { ReactNode } from "react";

/** Header module unifié — titre + lead (comme Coûts). */
export function ModulePageHeader({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <header className="module-page-header">
      <h1 className="module-page-title">{title}</h1>
      {lead ? <p className="module-page-lead">{lead}</p> : null}
      {children}
    </header>
  );
}
