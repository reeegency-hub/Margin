"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { euro } from "@/lib/dashboard";
import "@/components/mobile/app/mobile-app.css";

const SUGGESTIONS = [
  { label: "Stock", message: "Donne-moi un résumé du stock et des alertes." },
  { label: "Courses", message: "Qu’est-ce que je dois commander aujourd’hui ?" },
  { label: "WhatsApp", message: "Enregistre mon WhatsApp commerce." },
] as const;

function greetingLabel(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function DashboardScreen({
  userName,
  restaurantName,
  caToday,
  alertCount,
  alertMessage,
}: {
  userName: string;
  restaurantName: string;
  caToday: number;
  alertCount: number;
  alertMessage?: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const displayName = userName.trim() || restaurantName;

  const hello = useMemo(() => greetingLabel(), []);

  function goAsk(message?: string) {
    const text = (message ?? draft).trim();
    if (text) {
      try {
        sessionStorage.setItem("margin:mobile-ask", text);
      } catch {
        /* ignore */
      }
    }
    router.push("/assistant");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    goAsk();
  }

  return (
    <div className="mapp mapp-dash">
      <header className="mapp-dash__header">
        <div>
          <p className="mapp-dash__hello">{hello}</p>
          <h1 className="mapp-dash__name">{displayName}</h1>
        </div>
        <Link
          href="/settings"
          className="mapp-dash__account"
          aria-label="Compte et réglages"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="9" r="3.2" />
            <path d="M5 19c1.6-3.2 4-4.8 7-4.8s5.4 1.6 7 4.8" />
          </svg>
        </Link>
      </header>

      <div className="mapp-dash__kpis">
        <div className="mapp-dash__kpi">
          <p className="mapp-dash__kpi-label">CA du jour</p>
          <p className="mapp-dash__kpi-value">{euro(caToday)}</p>
        </div>
        <div className="mapp-dash__kpi">
          <p className="mapp-dash__kpi-label">Alertes</p>
          <p className="mapp-dash__kpi-value">{alertCount}</p>
        </div>
      </div>

      {alertMessage ? (
        <div className="mapp-dash__alert">
          <p className="mapp-dash__alert-label">À traiter</p>
          <p className="mapp-dash__alert-text">{alertMessage}</p>
        </div>
      ) : null}

      <section className="mapp-dash__ask-block" aria-label="Demander au copilote">
        <h2 className="mapp-dash__ask-title">Besoin de quelque chose ?</h2>
        <p className="mapp-dash__ask-lead">
          Demandez au copilote — stock, courses, WhatsApp, caisse.
        </p>
        <form className="mapp-dash__ask-form" onSubmit={onSubmit}>
          <input
            className="mapp-dash__ask-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything…"
            aria-label="Votre question"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.csv,.pdf,.txt"
            hidden
            onChange={() => goAsk(draft || "Analyse le fichier joint.")}
          />
          <button
            type="button"
            className="mapp-dash__ask-icon"
            aria-label="Joindre une photo"
            onClick={() => fileRef.current?.click()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 8h3l2-3h6l2 3h3v11H4V8z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          </button>
          <button
            type="button"
            className="mapp-dash__ask-icon"
            aria-label="Dicter"
            onClick={() => {
              const SR =
                typeof window !== "undefined"
                  ? (
                      window as unknown as {
                        SpeechRecognition?: new () => {
                          lang: string;
                          onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
                          onerror: (() => void) | null;
                          start: () => void;
                        };
                        webkitSpeechRecognition?: new () => {
                          lang: string;
                          onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
                          onerror: (() => void) | null;
                          start: () => void;
                        };
                      }
                    )
                  : null;
              const Ctor = SR?.SpeechRecognition || SR?.webkitSpeechRecognition;
              if (!Ctor) {
                goAsk();
                return;
              }
              const rec = new Ctor();
              rec.lang = "fr-FR";
              rec.onresult = (e) => {
                const text = e.results[0]?.[0]?.transcript || "";
                if (text) goAsk(text);
              };
              rec.onerror = () => goAsk();
              rec.start();
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0014 0M12 18v3" />
            </svg>
          </button>
          <button type="submit" className="mapp-dash__ask-go" aria-label="Envoyer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
        <div className="mapp-dash__chips">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              className="mapp-dash__chip"
              onClick={() => goAsk(s.message)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
