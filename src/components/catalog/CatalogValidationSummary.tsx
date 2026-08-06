"use client";

import type { CatalogValidationReport } from "@/lib/catalog/validate";

export function CatalogValidationSummary({
  report,
  compact = false,
}: {
  report: CatalogValidationReport;
  compact?: boolean;
}) {
  if (report.summary.total === 0) {
    return (
      <p className="flash mb-3 text-[14px]">
        Catalogue propre — aucune anomalie détectée.
      </p>
    );
  }

  return (
    <div className="flash flash-warn mb-3 space-y-2">
      <p className="text-[14px] font-medium">{report.headline}</p>
      {!compact ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-[13px]">
          {report.anomalies.slice(0, 12).map((a, i) => (
            <li key={`${a.kind}-${i}`}>
              <span className="opacity-60">
                {a.severity === "warn" ? "⚠" : "·"}
              </span>{" "}
              {a.title}
              {a.detail ? (
                <span className="opacity-70"> — {a.detail}</span>
              ) : null}
            </li>
          ))}
          {report.anomalies.length > 12 ? (
            <li className="opacity-60">
              … et {report.anomalies.length - 12} autre(s)
            </li>
          ) : null}
        </ul>
      ) : null}
      <p className="text-[12px] opacity-70">
        L’import n’est pas bloqué. Corrigez ici ou traitez dans Qualité catalogue
        après validation.
      </p>
    </div>
  );
}
