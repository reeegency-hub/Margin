"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SetupDraftConfirm } from "@/components/assistant/SetupDraftConfirm";
import {
  AssistantActionCard,
  type AssistantCardModel,
} from "@/components/assistant/AssistantActionCard";
import { PosWizardSkeleton } from "@/components/kiosks/PosWizardSkeleton";

type ChatMsg = {
  id: string;
  role: "assistant" | "user";
  text: string;
  links?: { label: string; href: string }[];
  draftId?: string;
  posProvider?: string;
  cards?: AssistantCardModel[];
};

const QUICK = [
  {
    label: "Inventaire",
    hint: "Import CSV / PDF",
    message: "Importe mon inventaire depuis le fichier joint.",
  },
  {
    label: "Équipe",
    hint: "Aperçu planning",
    message: "Voici mon équipe — prépare un aperçu planning.",
  },
  {
    label: "Stock",
    hint: "Résumé + alertes",
    message: "Donne-moi un résumé du stock et des alertes.",
  },
  {
    label: "Cette page",
    hint: "Que faire ici",
    message: "Explique-moi cette page et quoi faire maintenant.",
  },
  {
    label: "WhatsApp",
    hint: "Numéro commerce",
    message: "Enregistre mon WhatsApp commerce.",
  },
  {
    label: "Caisse",
    hint: "Wizard sécurisé",
    message: "Je veux brancher ma caisse.",
  },
];

const ALLOWED_EXT = /\.(csv|txt|tsv|md|json|pdf)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic)$/i;
const MAX_FILE_BYTES = 1_500_000;
const STORAGE_KEY = "margin:assistant-pane:open:v2";

const WELCOME =
  "Copilote **toujours ouvert** à droite de votre commerce.\n\n" +
  "Configurez (inventaire, équipe, WhatsApp), pilotez (stock, courses, coûts) ou demandez de l’aide sur cette page. " +
  "Les écritures passent par un **aperçu** avant validation.\n\n" +
  "Fermez-le avec × ou ⌘J — la page reste utilisable à gauche.";

const WELCOME_MOBILE =
  "Bonjour — je suis votre **copilote Margin**.\n\n" +
  "Demandez un résumé stock, une liste de courses, d’enregistrer WhatsApp ou de brancher la caisse. " +
  "Je prépare un **aperçu** avant toute écriture.";

function renderText(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="margin-asst__line">
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{part || "\u00a0"}</span>
          )
        )}
      </p>
    );
  });
}

function readExpandedDefault(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "0") return false;
  } catch {
    /* ignore */
  }
  return true;
}

/**
 * Panneau assistant type Cursor — docké à droite, page toujours active.
 */
export function MarginAssistant({
  expanded,
  onExpandedChange,
  layout = "dock",
}: {
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  /** page = onglet mobile plein cadre (pas de collapse dock) */
  layout?: "dock" | "page";
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [llmLabel, setLlmLabel] = useState<string | null>(null);
  /** null = chargement ; false = pas de clé BYOK */
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "assistant",
      text: layout === "page" ? WELCOME_MOBILE : WELCOME,
    },
  ]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, expanded, pending]);

  useEffect(() => {
    if (layout !== "page") return;
    onExpandedChange(true);
  }, [layout, onExpandedChange]);

  useEffect(() => {
    function onPrefill(e: Event) {
      const detail = (e as CustomEvent<{ text?: string }>).detail;
      const text = String(detail?.text || "").trim();
      if (!text) return;
      setInput(text);
      onExpandedChange(true);
    }
    window.addEventListener("margin:assistant-prefill", onPrefill);
    return () => window.removeEventListener("margin:assistant-prefill", onPrefill);
  }, [onExpandedChange]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings/llm-credentials");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const st = data.status as {
          configured?: boolean;
          status?: string;
          fingerprintDisplay?: string | null;
        } | null;
        if (!st) return;
        const ok = Boolean(st.configured);
        setLlmConfigured(ok);
        if (!ok) setLlmLabel("IA à connecter");
        else if (st.status === "untested") setLlmLabel("IA · à tester");
        else if (st.status === "invalid") setLlmLabel("IA · invalide");
        else
          setLlmLabel(
            st.fingerprintDisplay
              ? `IA · ${st.fingerprintDisplay}`
              : "IA connectée"
          );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const t = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(".margin-asst__input")
        ?.focus();
    }, 80);
    return () => window.clearTimeout(t);
  }, [expanded]);

  async function loadFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: "Fichier trop lourd (max ~1,5 Mo).",
        },
      ]);
      return;
    }
    const isPdf =
      file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isImage =
      file.type.startsWith("image/") || IMAGE_EXT.test(file.name);
    if (
      !ALLOWED_EXT.test(file.name) &&
      !file.type.startsWith("text/") &&
      !isPdf &&
      !isImage
    ) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: "Formats : CSV, TXT, PDF, ou photo (JPG/PNG).",
        },
      ]);
      return;
    }
    setFileName(file.name);
    if (isImage) {
      // Contexte UI — OCR image côté API à venir ; le nom reste joint au message.
      setFileText(`[Photo jointe : ${file.name}]`);
      setFileBase64(null);
      return;
    }
    if (isPdf) {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]!);
      }
      setFileBase64(btoa(binary));
      setFileText(null);
      return;
    }
    setFileText(await file.text());
    setFileBase64(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  }

  function send(raw: string) {
    const trimmed = raw.trim();
    if ((!trimmed && !fileText && !fileBase64) || pending) return;
    if (!expanded) onExpandedChange(true);

    const userText = [
      trimmed || "Importe les produits du fichier.",
      fileName ? `\n(Fichier : ${fileName})` : "",
    ].join("");

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: userText,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const history = [...messages, userMsg]
      .filter((m) => m.id !== "welcome")
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.text }));

    const payload = {
      message: trimmed || "Importe les produits du fichier joint.",
      pathname,
      fileText: fileText || undefined,
      fileBase64: fileBase64 || undefined,
      fileName: fileName || undefined,
      history,
    };

    setFileName(null);
    setFileText(null);
    setFileBase64(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              text: data.error || "Une erreur est survenue.",
            },
          ]);
          return;
        }
        const actions = Array.isArray(data.actions) ? data.actions : [];
        const draft = actions.find(
          (a: { type?: string }) => a.type === "setup_draft"
        ) as { draftId?: string } | undefined;
        const pos = actions.find(
          (a: { type?: string }) => a.type === "open_pos_wizard"
        ) as { provider?: string } | undefined;
        const cards = actions
          .filter((a: { type?: string }) => a.type === "ui_card")
          .map(
            (a: AssistantCardModel & { type?: string }): AssistantCardModel => ({
              badge: String(a.badge || "Info"),
              title: String(a.title || ""),
              lead: a.lead ? String(a.lead) : undefined,
              steps: Array.isArray(a.steps)
                ? a.steps.map((s) => String(s))
                : undefined,
              cta: a.cta
                ? {
                    label: String(a.cta.label),
                    href: String(a.cta.href),
                  }
                : undefined,
              secondary: a.secondary
                ? {
                    label: String(a.secondary.label),
                    href: String(a.secondary.href),
                  }
                : undefined,
            })
          )
          .filter((c: AssistantCardModel) => c.title);

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: String(data.reply || "C’est noté."),
            draftId: draft?.draftId,
            posProvider: pos?.provider,
            cards: cards.length ? cards : undefined,
            links:
              cards.length || pos
                ? undefined
                : Array.isArray(data.links)
                  ? data.links
                  : undefined,
          },
        ]);

        if (
          actions.some(
            (a: { type?: string }) =>
              a.type === "create_products" || a.type === "setup_draft"
          )
        ) {
          router.refresh();
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: "Connexion impossible. Réessayez.",
          },
        ]);
      }
    });
  }

  const isPage = layout === "page";
  const effectiveExpanded = isPage ? true : expanded;

  return (
    <aside
      ref={panelRef}
      className={`margin-asst-pane${effectiveExpanded ? " is-expanded" : " is-collapsed"}${
        isPage ? " margin-asst-pane--page" : ""
      }`}
      aria-label="Copilote Margin"
      aria-expanded={effectiveExpanded}
      onDragOver={(e) => {
        if (!effectiveExpanded) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {!effectiveExpanded ? (
        <button
          type="button"
          className="margin-asst-pane__tab"
          onClick={() => onExpandedChange(true)}
          aria-label="Ouvrir le Copilote"
        >
          <span className="margin-asst-pane__tab-icon" aria-hidden>
            ✦
          </span>
          <span className="margin-asst-pane__tab-label">Copilote</span>
        </button>
      ) : (
        <div className="margin-asst-pane__body ms-spot__card">
          <header className="margin-asst-pane__head">
            <div className="margin-asst-pane__titles">
              <p className="ms-spot__eyebrow margin-asst-pane__eyebrow">
                {isPage ? "Toujours avec vous" : "Toujours à droite"}
              </p>
              <h2 id={titleId} className="ms-spot__title margin-asst-pane__title">
                Copilote
              </h2>
            </div>
            <div className="margin-asst-pane__tools">
              {llmLabel ? (
                <Link
                  href="/settings?tab=avance"
                  className="margin-asst-pane__llm"
                >
                  {llmLabel}
                </Link>
              ) : null}
              {!isPage ? (
                <button
                  type="button"
                  className="ms-spot__close margin-asst-pane__close"
                  aria-label="Fermer le Copilote"
                  title="Fermer (⌘J)"
                  onClick={() => onExpandedChange(false)}
                >
                  ×
                </button>
              ) : null}
            </div>
          </header>

          <div className="margin-asst-pane__context">
            <span className="margin-asst-pane__ctx-label">Page</span>
            <code className="margin-asst-pane__ctx-path">{pathname}</code>
          </div>

          {llmConfigured === false ? (
            <p className="margin-asst-pane__alert" role="status">
              Sans clé IA : les imports CSV/PDF restent disponibles. Pour
              discuter librement avec le Copilote, connectez une clé Anthropic
              ou OpenAI dans{" "}
              <Link href="/settings?tab=avance">les réglages</Link>.
            </p>
          ) : null}

          <div
            className="margin-asst-pane__quick"
            role="group"
            aria-label="Actions rapides"
          >
            {QUICK.map((q) => (
              <button
                key={q.label}
                type="button"
                className="margin-asst-pane__chip"
                disabled={pending}
                onClick={() => send(q.message)}
              >
                <span className="margin-asst-pane__chip-label">{q.label}</span>
                <span className="margin-asst-pane__chip-hint">{q.hint}</span>
              </button>
            ))}
          </div>

          <div className="margin-asst-pane__thread" aria-live="polite">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`margin-asst-pane__msg margin-asst-pane__msg--${m.role}`}
              >
                {renderText(m.text)}
                {m.draftId ? (
                  <SetupDraftConfirm
                    draftId={m.draftId}
                    onDone={(summary) => {
                      setMessages((prev) => [
                        ...prev,
                        {
                          id: `ok-${Date.now()}`,
                          role: "assistant",
                          text: summary,
                        },
                      ]);
                      router.refresh();
                    }}
                  />
                ) : null}
                {m.posProvider != null ? (
                  <PosWizardSkeleton provider={m.posProvider} />
                ) : null}
                {m.cards?.map((card, i) => (
                  <AssistantActionCard
                    key={`${m.id}-card-${i}`}
                    {...card}
                  />
                ))}
                {m.links?.length &&
                m.posProvider == null &&
                !m.cards?.length ? (
                  <div className="margin-asst-pane__links">
                    {m.links.map((l) => (
                      <Link key={l.href} href={l.href}>
                        {l.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {pending ? (
              <p className="margin-asst-pane__typing">Réflexion…</p>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div
            className={`margin-asst-pane__composer${dragOver ? " is-over" : ""}`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv,.md,.json,.pdf,text/plain,text/csv,application/pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f);
                e.target.value = "";
              }}
            />
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f);
                e.target.value = "";
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f);
                e.target.value = "";
              }}
            />
            {fileName ? (
              <p className="margin-asst-pane__file">
                {fileName}
                <button
                  type="button"
                  onClick={() => {
                    setFileName(null);
                    setFileText(null);
                    setFileBase64(null);
                  }}
                >
                  ×
                </button>
              </p>
            ) : (
              <div className="margin-asst-pane__attach-bar" role="group" aria-label="Joindre">
                <button
                  type="button"
                  className="margin-asst-pane__icon-attach"
                  title="Fichier (CSV, PDF…)"
                  aria-label="Épingler un fichier"
                  onClick={() => fileRef.current?.click()}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M16 12V6.5a2.5 2.5 0 00-5 0V15a4 4 0 008 0V8" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="margin-asst-pane__icon-attach"
                  title="Prendre une photo"
                  aria-label="Prendre une photo"
                  onClick={() => photoRef.current?.click()}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8z" />
                    <circle cx="12" cy="13.5" r="3.2" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="margin-asst-pane__icon-attach"
                  title="Galerie"
                  aria-label="Choisir dans la galerie"
                  onClick={() => galleryRef.current?.click()}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="8.5" cy="9.5" r="1.5" />
                    <path d="M3 16l5-4 4 3 3-2 6 5" />
                  </svg>
                </button>
              </div>
            )}
            <form
              className="margin-asst-pane__form"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <textarea
                className="margin-asst__input margin-asst-pane__input"
                rows={2}
                value={input}
                placeholder="Demandez n’importe quoi sur le commerce…"
                disabled={pending}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <button
                type="submit"
                className="margin-asst-pane__send"
                disabled={
                  pending || (!input.trim() && !fileText && !fileBase64)
                }
              >
                ↑
              </button>
            </form>
            <p className="ms-spot__hint margin-asst-pane__safe">
              Aperçu avant écriture · ⌘J pour fermer
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

export { readExpandedDefault };
