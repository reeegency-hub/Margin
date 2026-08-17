"use client";

import { useState } from "react";

export function CopyTextButton({
  text,
  label = "Copier",
  className = "btn-ghost text-sm",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiez :", text);
    }
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? "Copié" : label}
    </button>
  );
}
