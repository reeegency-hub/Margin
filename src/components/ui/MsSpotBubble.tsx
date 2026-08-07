"use client";

import type { CSSProperties, ReactNode, Ref } from "react";

/**
 * Bulle spotlight Margin — même langage UI partout
 * (assistant, guide démarrage, première visite).
 */
export function MsSpotBubble({
  eyebrow,
  title,
  titleId,
  lead,
  list,
  children,
  actions,
  hint,
  style,
  className = "",
  panelRef,
}: {
  eyebrow?: string;
  title: string;
  titleId?: string;
  lead?: string;
  list?: string[];
  children?: ReactNode;
  actions?: ReactNode;
  hint?: string;
  style?: CSSProperties;
  className?: string;
  panelRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={panelRef}
      className={`ms-spot__bubble ${className}`.trim()}
      style={style}
    >
      {eyebrow ? <p className="ms-spot__eyebrow">{eyebrow}</p> : null}
      <h2 id={titleId} className="ms-spot__title">
        {title}
      </h2>
      {lead ? <p className="ms-spot__lead">{lead}</p> : null}
      {list && list.length > 0 ? (
        <ul className="ms-spot__list">
          {list.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {children}
      {actions ? <div className="ms-spot__actions">{actions}</div> : null}
      {hint ? <p className="ms-spot__hint">{hint}</p> : null}
    </div>
  );
}

export function MsSpotRing({
  top,
  left,
  width,
  height,
  pad = 6,
}: {
  top: number;
  left: number;
  width: number;
  height: number;
  pad?: number;
}) {
  return (
    <div
      className="ms-spot__ring"
      style={{
        top: top - pad,
        left: left - pad,
        width: width + pad * 2,
        height: height + pad * 2,
      }}
      aria-hidden
    />
  );
}
