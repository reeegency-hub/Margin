import type { ReactNode } from "react";

/**
 * Signalétique feature : titre gras + sous-titre.
 * Chaque bloc métier démarre ainsi pour que le client sache qu’il change de feature.
 */
export function FeatureSection({
  title,
  subtitle,
  children,
  next = false,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Séparateur haut — nouvelle feature dans la page */
  next?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`feature-block${next ? " feature-block--next" : ""} ${className}`.trim()}
    >
      <div className="feature-block__intro">
        <h2 className="feature-block__title">{title}</h2>
        {subtitle ? (
          <p className="feature-block__subtitle">{subtitle}</p>
        ) : null}
      </div>
      {children ? <div className="feature-block__body">{children}</div> : null}
    </section>
  );
}
