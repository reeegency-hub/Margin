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
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

type ChatMsg = {
  id: string;
  role: "assistant" | "user";
  text: string;
  links?: { label: string; href: string }[];
};

const QUICK = [
  { label: "Créer des produits", message: "Aide-moi à créer des fiches produits dans le stock." },
  { label: "État du stock", message: "Fais-moi un résumé de mon stock et des alertes." },
  { label: "Expliquer cette page", message: "Explique-moi quoi faire sur cette page." },
];

const ALLOWED_EXT = /\.(csv|txt|tsv|md|json)$/i;
const MAX_FILE_BYTES = 200_000;

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

export function MarginAssistant({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Je suis l’assistant Margin. Dites-moi ce que vous voulez faire — ou collez / joignez une liste (CSV, TXT) pour créer vos produits.",
    },
  ]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, pending]);

  useEffect(() => {
    if (!open) return;
    const primary = panelRef.current?.querySelector<HTMLElement>(
      ".margin-asst__input"
    );
    primary?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function loadFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: "Fichier trop lourd (max ~200 Ko). Exportez un CSV plus court.",
        },
      ]);
      return;
    }
    if (!ALLOWED_EXT.test(file.name) && !file.type.startsWith("text/")) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: "Formats acceptés : CSV, TXT, TSV. Pas d’exécutables ni de PDF pour l’instant.",
        },
      ]);
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setFileText(text);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  }

  function send(raw: string) {
    const trimmed = raw.trim();
    if ((!trimmed && !fileText) || pending) return;

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
      fileName: fileName || undefined,
      history,
    };

    setFileName(null);
    setFileText(null);

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
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: data.reply || "C’est noté.",
            links: data.links,
          },
        ]);
        if (
          Array.isArray(data.actions) &&
          data.actions.some(
            (a: { type?: string }) => a.type === "create_products"
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
            text: "Connexion impossible. Réessayez dans un instant.",
          },
        ]);
      }
    });
  }

  if (!open) return null;

  return (
    <div
      className="margin-asst-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        className="margin-asst"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <header className="margin-asst__head">
          <div>
            <p className="margin-asst__eyebrow">Margin</p>
            <h2 id={titleId} className="margin-asst__title">
              Assistant magasin
            </h2>
          </div>
          <button
            type="button"
            className="margin-asst__close"
            aria-label="Fermer"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="margin-asst__quick">
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              className="margin-asst__chip"
              disabled={pending}
              onClick={() => send(q.message)}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="margin-asst__thread" aria-live="polite">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`margin-asst__bubble margin-asst__bubble--${m.role}`}
            >
              {renderText(m.text)}
              {m.links?.length ? (
                <div className="margin-asst__links">
                  {m.links.map((l) => (
                    <Link key={l.href} href={l.href} onClick={onClose}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {pending ? (
            <p className="margin-asst__typing">L’assistant réfléchit…</p>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div
          className={`margin-asst__drop${dragOver ? " is-over" : ""}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv,.md,.json,text/plain,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
              e.target.value = "";
            }}
          />
          {fileName ? (
            <p className="margin-asst__file">
              Fichier prêt : <strong>{fileName}</strong>
              <button
                type="button"
                onClick={() => {
                  setFileName(null);
                  setFileText(null);
                }}
              >
                Retirer
              </button>
            </p>
          ) : (
            <button
              type="button"
              className="margin-asst__attach"
              onClick={() => fileRef.current?.click()}
            >
              Joindre une liste (CSV / TXT)
            </button>
          )}
        </div>

        <form
          className="margin-asst__form"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            className="margin-asst__input"
            rows={2}
            value={input}
            placeholder="Ex. Crée 10 produits à partir de mon fichier…"
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
            className="margin-asst__send"
            disabled={pending || (!input.trim() && !fileText)}
          >
            Envoyer
          </button>
        </form>
        <p className="margin-asst__safe">
          Actions limitées au magasin · pas d’accès admin · raccourci ⌘J
        </p>
      </aside>
    </div>
  );
}
