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
    <div className="partner-card partner-referral">
      <p className="brand-eyebrow partner-referral__eyebrow">Parrainage</p>
      <h2>Votre code personnel</h2>
      <p className="partner-muted">
        Partagez ce code ou le lien d’inscription aux commerces que vous amenez.
      </p>
      <div className="partner-referral__row">
        <code className="partner-referral__code">{code}</code>
        <button
          type="button"
          className="partner-btn"
          onClick={() => copy(code, "code")}
        >
          {copied === "code" ? "Copié" : "Copier le code"}
        </button>
      </div>
      <div className="partner-referral__row partner-referral__row--link">
        <span className="partner-referral__url">{signupUrl}</span>
        <button
          type="button"
          className="partner-btn"
          onClick={() => copy(signupUrl, "link")}
        >
          {copied === "link" ? "Copié" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
}
