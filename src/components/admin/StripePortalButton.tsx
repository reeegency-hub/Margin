"use client";

import { useState } from "react";

export function StripePortalButton({ restaurantId }: { restaurantId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Portal Stripe indisponible");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Erreur réseau Stripe portal");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn-ghost"
        disabled={loading}
        onClick={openPortal}
      >
        {loading ? "Ouverture…" : "Ouvrir le portail Stripe"}
      </button>
      {error ? (
        <p className="mt-1 text-[12px] text-[var(--accent-lime)]">{error}</p>
      ) : null}
    </div>
  );
}
