"use client";

import { useState } from "react";

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Impossible d’ouvrir le portail Stripe");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn"
        disabled={loading}
        onClick={() => void openPortal()}
      >
        {loading ? "Ouverture…" : "Mettre à jour ma carte"}
      </button>
      {error ? <p className="mt-1 text-[13px] text-red-700">{error}</p> : null}
    </div>
  );
}
