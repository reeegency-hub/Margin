"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createManualSaleAction } from "@/app/actions";
import { matchSpokenToCatalog, parseSpokenSale } from "@/lib/voice-intent";
import "./manual-sale.css";

export type ManualSaleProduct = {
  id: string;
  name: string;
  salePrice: number;
  sku: string | null;
  stockLabel: string | null;
};

export type RecentManualSale = {
  id: string;
  soldAt: string;
  items: { name: string; quantity: number }[];
};

type Line = { productId: string; quantity: number };

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: {
    results: { length: number; [i: number]: { [j: number]: { transcript: string } } };
  }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSpeechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function ManualSalePanel({
  products,
  recent,
}: {
  products: ManualSaleProduct[];
  recent: RecentManualSale[];
}) {
  const router = useRouter();
  const recRef = useRef<SpeechRec | null>(null);
  const holdAtRef = useRef(0);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [micOk, setMicOk] = useState(false);

  useEffect(() => {
    setMicOk(Boolean(getSpeechCtor()));
  }, []);

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const basket = lines
    .map((l) => {
      const p = byId.get(l.productId);
      return p ? { ...l, product: p } : null;
    })
    .filter((l): l is Line & { product: ManualSaleProduct } => Boolean(l));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [products, query]);

  function bump(productId: string, delta: number) {
    setError(null);
    setOkMsg(null);
    setLines((prev) => {
      const cur = prev.find((l) => l.productId === productId)?.quantity ?? 0;
      const next = Math.max(0, cur + delta);
      const rest = prev.filter((l) => l.productId !== productId);
      if (next <= 0) return rest;
      return [...rest, { productId, quantity: next }];
    });
  }

  function applySpeech(text: string) {
    const spoken = parseSpokenSale(text);
    if (!spoken.length) {
      setError("Je n’ai pas compris. Dites par ex. « deux lait et un pain ».");
      return;
    }
    const { matched, unknown } = matchSpokenToCatalog(spoken, products);
    if (!matched.length) {
      setError(
        unknown.length
          ? `Pas trouvé : ${unknown.join(", ")}.`
          : "Aucun produit reconnu."
      );
      return;
    }
    setLines((prev) => {
      const map = new Map(prev.map((l) => [l.productId, l.quantity]));
      for (const m of matched) {
        map.set(m.product.id, (map.get(m.product.id) ?? 0) + m.quantity);
      }
      return [...map.entries()].map(([productId, quantity]) => ({
        productId,
        quantity,
      }));
    });
    if (unknown.length) {
      setError(`Ajouté. Pas trouvé : ${unknown.join(", ")}.`);
    }
  }

  function stopMic() {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }

  function startMic() {
    const Ctor = getSpeechCtor();
    if (!Ctor) {
      setError("Le micro n’est pas dispo ici. Tapez le nom du produit.");
      return;
    }
    if (listening) return;
    setError(null);
    setOkMsg(null);
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const last = ev.results[ev.results.length - 1];
      const text = last?.[0]?.transcript?.trim() || "";
      if (text) {
        setHeard(text);
        applySpeech(text);
      }
    };
    rec.onerror = () => {
      setListening(false);
      recRef.current = null;
      setError("Micro coupé. Réessayez ou tapez le nom.");
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setError("Impossible d’ouvrir le micro.");
    }
  }

  function submit() {
    if (!basket.length) {
      setError("Dites ou ajoutez au moins un produit.");
      return;
    }
    startTransition(async () => {
      const res = await createManualSaleAction(
        basket.map((l) => ({ productId: l.productId, quantity: l.quantity }))
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLines([]);
      setHeard("");
      setQuery("");
      setOkMsg("C’est noté — le stock a baissé.");
      router.refresh();
    });
  }

  if (!products.length) {
    return (
      <div className="msale">
        <p className="msale__hint">Ajoutez d’abord vos produits.</p>
        <Link href="/ingredients/menu" className="btn-lime">
          Importer le catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="msale">
      {okMsg ? <p className="flash">{okMsg}</p> : null}
      {error ? <p className="flash flash-warn">{error}</p> : null}

      <button
        type="button"
        className={`msale__mic${listening ? " is-on" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          if (listening) {
            stopMic();
            return;
          }
          holdAtRef.current = Date.now();
          startMic();
        }}
        onPointerUp={() => {
          if (Date.now() - holdAtRef.current < 280) return;
          stopMic();
        }}
        onPointerCancel={stopMic}
        onContextMenu={(e) => e.preventDefault()}
        aria-pressed={listening}
        aria-label="Parler"
      >
        <svg
          className="msale__mic-icon"
          viewBox="0 0 24 24"
          width="28"
          height="28"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
          />
        </svg>
        {listening ? "Parlez…" : micOk ? "Parler" : "Parler (Chrome / Safari)"}
      </button>
      <p className="msale__hint">
        {heard ? `« ${heard} »` : "Ex. « deux lait et un pain »"}
      </p>

      <label className="msale__search">
        <span className="sr-only">Chercher</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ou tapez le nom…"
          autoComplete="off"
        />
      </label>

      {filtered.length > 0 ? (
        <ul className="msale__hits">
          {filtered.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => bump(p.id, 1)}>
                {p.name}
                <span>+1</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {basket.length > 0 ? (
        <ul className="msale__lines">
          {basket.map((l) => (
            <li key={l.productId}>
              <span className="msale__name">{l.product.name}</span>
              <div className="msale__step">
                <button
                  type="button"
                  onClick={() => bump(l.productId, -1)}
                  aria-label="Moins"
                >
                  −
                </button>
                <b>{l.quantity}</b>
                <button
                  type="button"
                  onClick={() => bump(l.productId, 1)}
                  aria-label="Plus"
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        className="btn-lime msale__go"
        disabled={pending || !basket.length}
        onClick={submit}
      >
        {pending ? "…" : "C’est vendu"}
      </button>

      {recent[0] ? (
        <p className="msale__last">
          Dernière : {recent[0].soldAt} ·{" "}
          {recent[0].items.map((i) => `${i.quantity} ${i.name}`).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
