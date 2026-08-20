"use client";

import { useState } from "react";

export function PartnerReferralCard({
  code,
  signupUrl,
}: {
  code: string;
  signupUrl: string;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(text: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copiez :", text);
    }
  }

  return (
    <section className="partner-referral" aria-labelledby="partner-referral-title">
      <div className="partner-referral__bg" aria-hidden />
      <div className="partner-referral__copy">
        <p className="partner-referral__eyebrow">Parrainage</p>
        <h2 id="partner-referral-title">
          Votre code.
          <em> Votre lien.</em>
        </h2>
        <p className="partner-referral__lead">
          Partagez-les aux commerces que vous amenez — l’inscription les rattache
          à vous.
        </p>
      </div>

      <div className="partner-referral__actions">
        <div className="partner-referral__block">
          <span className="partner-referral__label">Code</span>
          <div className="partner-referral__row">
            <code className="partner-referral__code">{code}</code>
            <button
              type="button"
              className="partner-btn partner-btn--lime"
              onClick={() => copy(code, "code")}
            >
              {copied === "code" ? "Copié" : "Copier"}
            </button>
          </div>
        </div>

        <div className="partner-referral__block">
          <span className="partner-referral__label">Lien d’inscription</span>
          <div className="partner-referral__row partner-referral__row--link">
            <span className="partner-referral__url" title={signupUrl}>
              {signupUrl}
            </span>
            <button
              type="button"
              className="partner-btn partner-btn--ghost-light"
              onClick={() => copy(signupUrl, "link")}
            >
              {copied === "link" ? "Copié" : "Copier le lien"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
