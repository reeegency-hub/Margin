"use client";

import { useState } from "react";
import { subscribeNewsletterAction } from "@/app/actions";

export function NewsletterSignupForm({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");
    const res = await subscribeNewsletterAction({ email, source: "landing" });
    setLoading(false);
    if (!res.ok) {
      setStatus("error");
      setMessage(res.error);
      return;
    }
    setStatus("ok");
    setMessage("Inscription confirmée — vérifiez votre boîte mail.");
    setEmail("");
  }

  const isDark = variant === "dark";

  return (
    <form onSubmit={onSubmit} className="newsletter-form space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@email.fr"
          autoComplete="email"
          aria-label="Email pour la newsletter"
          className={
            isDark
              ? "min-h-11 flex-1 rounded-[12px] border border-white/20 bg-white/10 px-3 text-[15px] text-white placeholder:text-white/50"
              : "min-h-11 flex-1 rounded-[12px] border border-black/10 bg-white px-3 text-[15px]"
          }
        />
        <button
          type="submit"
          disabled={loading}
          className={
            isDark
              ? "land-btn land-btn--white min-h-11 shrink-0"
              : "land-btn land-btn--dark min-h-11 shrink-0"
          }
        >
          {loading ? "…" : "S’inscrire"}
        </button>
      </div>
      {status !== "idle" ? (
        <p
          className={
            status === "ok"
              ? "text-[13px] opacity-80"
              : "text-[13px] text-red-600"
          }
        >
          {message}
        </p>
      ) : (
        <p className="text-[12px] opacity-60">
          Conseils stock, 1–2 fois / mois. Désinscription en 1 clic.
        </p>
      )}
    </form>
  );
}
