"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SetupDraftConfirm } from "@/components/assistant/SetupDraftConfirm";
import {
  AssistantActionCard,
  type AssistantCardModel,
} from "@/components/assistant/AssistantActionCard";
import { PosWizardSkeleton } from "@/components/kiosks/PosWizardSkeleton";
import "@/components/mobile/app/mobile-app.css";

type ChatMsg = {
  id: string;
  role: "assistant" | "user";
  text: string;
  links?: { label: string; href: string }[];
  draftId?: string;
  posProvider?: string;
  cards?: AssistantCardModel[];
};

const ACTIONS = [
  {
    label: "État du stock",
    message: "Donne-moi un résumé clair du stock et des alertes prioritaires.",
  },
  {
    label: "Photo rayon",
    message: "Je vais joindre une photo de rayon — aide-moi à vérifier le stock.",
    needsPhoto: true,
  },
  {
    label: "Liste de courses",
    message: "Prépare une liste de courses à partir des manques stock.",
  },
  {
    label: "Brancher caisse",
    href: "/kiosks",
  },
] as const;

const ALLOWED_EXT = /\.(csv|txt|tsv|md|json|pdf)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic)$/i;
const MAX_FILE_BYTES = 1_500_000;

function greetingLabel() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour,";
  if (h < 18) return "Bon après-midi,";
  return "Bonsoir,";
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "M";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function renderText(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="mapp-ask__line">
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

function IconCam() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function IconBag() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M6 7h12l-1 13H7L6 7z" />
      <path d="M9 7V5a3 3 0 016 0v2" />
    </svg>
  );
}

/** Accueil mobile type « Need anything? » — copilote au centre. */
export function CopilotScreen({
  restaurantName,
  userName,
}: {
  restaurantName: string;
  userName?: string | null;
}) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const displayName = (userName || restaurantName || "Commerce").trim();
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);

  const chatting = messages.length > 0 || pending;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings/llm-credentials");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const st = data.status as { configured?: boolean } | null;
        if (!cancelled && st) setLlmConfigured(Boolean(st.configured));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!chatting) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, chatting]);

  async function loadFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: "Fichier trop lourd (max ~1,5 Mo). Compressez la photo ou le PDF.",
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
          text: "Formats acceptés : photo, CSV ou PDF.",
        },
      ]);
      return;
    }

    setFileName(file.name);

    if (isImage) {
      setFileText(`[Photo jointe : ${file.name}]`);
      setFileBase64(null);
      return;
    }

    if (isPdf) {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      setFileBase64(btoa(binary));
      setFileText(null);
      return;
    }

    setFileText(await file.text());
    setFileBase64(null);
  }

  function clearFile() {
    setFileName(null);
    setFileText(null);
    setFileBase64(null);
  }

  function resetHome() {
    setMessages([]);
    setInput("");
    clearFile();
  }

  function send(raw: string) {
    const trimmed = raw.trim();
    if ((!trimmed && !fileText && !fileBase64) || pending) return;

    const userText = [
      trimmed || (fileBase64 ? "Voici une photo." : "Importe le fichier joint."),
      fileName ? `\n(${fileName})` : "",
    ].join("");

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: userText,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const history = [...messages, userMsg]
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.text }));

    const payload = {
      message:
        trimmed ||
        (fileBase64 ? "Analyse cette photo." : "Importe les produits du fichier joint."),
      pathname: "/",
      fileText: fileText || undefined,
      fileBase64: fileBase64 || undefined,
      fileName: fileName || undefined,
      history,
    };

    clearFile();

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
                ? { label: String(a.cta.label), href: String(a.cta.href) }
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
            text: "Connexion impossible. Vérifiez le réseau et réessayez.",
          },
        ]);
      }
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onAction(action: (typeof ACTIONS)[number]) {
    if ("href" in action && action.href) {
      router.push(action.href);
      return;
    }
    if ("needsPhoto" in action && action.needsPhoto) {
      setInput(action.message);
      window.setTimeout(() => photoRef.current?.click(), 80);
      return;
    }
    if ("message" in action) {
      send(action.message);
    }
  }

  const canSend = Boolean(input.trim() || fileText || fileBase64) && !pending;

  const fileInputs = (
    <>
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
    </>
  );

  const askBar = (
    <form className="mapp-ask__bar" onSubmit={onSubmit}>
      <button
        type="button"
        className="mapp-ask__cam"
        aria-label="Prendre une photo"
        onClick={() => photoRef.current?.click()}
      >
        <IconCam />
      </button>
      <input
        ref={inputRef}
        className="mapp-ask__input"
        value={input}
        placeholder="Demandez n’importe quoi…"
        disabled={pending}
        enterKeyHint="send"
        autoComplete="off"
        onChange={(e) => setInput(e.target.value)}
      />
      <button
        type="submit"
        className="mapp-ask__send"
        disabled={!canSend}
        aria-label="Envoyer"
      >
        <IconSend />
      </button>
    </form>
  );

  if (!chatting) {
    return (
      <main className="mapp mapp-ask" aria-label="Accueil Margin">
        <header className="mapp-ask__header">
          <div className="mapp-ask__identity">
            <span className="mapp-ask__avatar" aria-hidden>
              {initialsOf(displayName)}
            </span>
            <div>
              <p className="mapp-ask__hello">{greetingLabel()}</p>
              <p className="mapp-ask__name">{displayName}</p>
            </div>
          </div>
          <Link
            href="/settings"
            className="mapp-ask__bag"
            aria-label="Réglages"
          >
            <IconBag />
          </Link>
        </header>

        {llmConfigured === false ? (
          <p className="mapp-ask__banner" role="status">
            Ajoutez une clé IA dans{" "}
            <Link href="/settings">Réglages</Link> pour discuter librement.
          </p>
        ) : null}

        <div className="mapp-ask__hero">
          <h1 className="mapp-ask__title">Besoin de quelque chose&nbsp;?</h1>
          <p className="mapp-ask__lead">
            Votre copilote trouve ce qu’il faut pour le stock, les courses et la
            caisse — plus vite qu’à la main.
          </p>

          {fileName ? (
            <div className="mapp-ask__file">
              <span>{fileName}</span>
              <button type="button" onClick={clearFile}>
                Retirer
              </button>
            </div>
          ) : null}

          {askBar}

          <div className="mapp-ask__chips" role="group" aria-label="Suggestions">
            {ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className="mapp-ask__chip"
                disabled={pending}
                onClick={() => onAction(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {fileInputs}
      </main>
    );
  }

  return (
    <main className="mapp mapp-ask mapp-ask--chat" aria-label="Copilote Margin">
      <header className="mapp-ask__header mapp-ask__header--chat">
        <button
          type="button"
          className="mapp-ask__back"
          onClick={resetHome}
          aria-label="Retour à l’accueil"
        >
          ←
        </button>
        <div>
          <p className="mapp-ask__hello">Copilote</p>
          <p className="mapp-ask__name">
            {pending ? "Réflexion…" : "En conversation"}
          </p>
        </div>
        <Link href="/settings" className="mapp-ask__bag" aria-label="Réglages">
          <IconBag />
        </Link>
      </header>

      <div className="mapp-ask__thread" aria-live="polite">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`mapp-ask__bubble mapp-ask__bubble--${m.role}`}
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
              <AssistantActionCard key={`${m.id}-card-${i}`} {...card} />
            ))}
            {m.links?.length && m.posProvider == null && !m.cards?.length ? (
              <div className="mapp-ask__links">
                {m.links.map((l) => (
                  <Link key={l.href} href={l.href}>
                    {l.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {pending ? <p className="mapp-ask__typing">Réflexion…</p> : null}
        <div ref={bottomRef} />
      </div>

      <div className="mapp-ask__dock">
        {fileName ? (
          <div className="mapp-ask__file">
            <span>{fileName}</span>
            <button type="button" onClick={clearFile}>
              Retirer
            </button>
          </div>
        ) : null}
        <div className="mapp-ask__chips mapp-ask__chips--dock" role="group" aria-label="Suggestions">
          {ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              className="mapp-ask__chip"
              disabled={pending}
              onClick={() => onAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
        {askBar}
      </div>

      {fileInputs}
    </main>
  );
}
