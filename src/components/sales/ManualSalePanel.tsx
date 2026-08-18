"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createManualSaleAction,
  transcribeManualSaleAction,
} from "@/app/actions";
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

const MAX_REC_MS = 20_000;

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
}

export function ManualSalePanel({
  products,
  recent,
}: {
  products: ManualSaleProduct[];
  recent: RecentManualSale[];
}) {
  const router = useRouter();
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [heard, setHeard] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [canRecord, setCanRecord] = useState(false);

  useEffect(() => {
    setCanRecord(
      typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  useEffect(() => {
    return () => {
      stopTracks();
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
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

  const picks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku && p.sku.toLowerCase().includes(q))
        )
      : products;
    return list.slice(0, q ? 8 : 12);
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

  function addMatched(
    matched: { productId: string; quantity: number }[],
    unknown: string[]
  ) {
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
        map.set(m.productId, (map.get(m.productId) ?? 0) + m.quantity);
      }
      return [...map.entries()].map(([productId, quantity]) => ({
        productId,
        quantity,
      }));
    });
    if (unknown.length) {
      setError(`Ajouté. Pas trouvé : ${unknown.join(", ")}.`);
    } else {
      setError(null);
    }
  }

  function applyText(text: string) {
    const spoken = parseSpokenSale(text);
    if (!spoken.length) {
      setError("Exemple : « 2 lait, 1 pain ».");
      return;
    }
    const { matched, unknown } = matchSpokenToCatalog(spoken, products);
    addMatched(
      matched.map((m) => ({ productId: m.product.id, quantity: m.quantity })),
      unknown
    );
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRec() {
    if (recording || transcribing || !canRecord) return;
    setError(null);
    setOkMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        void finishRec(rec.mimeType || mime || "audio/webm");
      };
      recRef.current = rec;
      rec.start();
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        const ms = Date.now() - startedAtRef.current;
        setElapsed(ms);
        if (ms >= MAX_REC_MS) stopRec();
      }, 200);
    } catch {
      stopTracks();
      setError("Micro refusé. Autorisez-le, ou notez la vente à la main.");
    }
  }

  function stopRec() {
    stopTimer();
    const rec = recRef.current;
    recRef.current = null;
    if (rec && rec.state !== "inactive") {
      try {
        rec.requestData();
      } catch {
        /* Safari */
      }
      rec.stop();
    } else {
      stopTracks();
      setRecording(false);
    }
  }

  async function finishRec(mimeType: string) {
    setRecording(false);
    stopTracks();
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (blob.size < 800) {
      setError("Trop court. Appuyez, parlez, puis arrêtez.");
      return;
    }
    setTranscribing(true);
    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await transcribeManualSaleAction({ audioBase64, mimeType });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setHeard(res.text);
      addMatched(res.matched, res.unknown);
    } catch {
      setError("Dictée impossible. Notez à la main.");
    } finally {
      setTranscribing(false);
    }
  }

  function addNote() {
    const text = note.trim();
    if (!text) return;
    setHeard(text);
    applyText(text);
    setNote("");
  }

  function submit() {
    if (!basket.length) {
      setError("Dictez, notez, ou touchez un produit.");
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
      setNote("");
      setOkMsg("C’est noté — le stock a baissé.");
      router.refresh();
    });
  }

  const recLabel = recording
    ? `Stop · ${Math.max(1, Math.ceil((MAX_REC_MS - elapsed) / 1000))}s`
    : transcribing
      ? "Écoute…"
      : "Dictez";

  if (!products.length) {
    return (
      <div className="msale">
        <p className="msale__hint">
          Une fois vos produits en stock, vous noterez ici les ventes sans
          caisse — à la voix ou à la main.
        </p>
        <Link href="/ingredients" className="btn-ghost">
          Voir le stock
        </Link>
      </div>
    );
  }

  return (
    <div className="msale">
      {okMsg ? <p className="flash">{okMsg}</p> : null}
      {error ? <p className="flash flash-warn">{error}</p> : null}

      <div className="msale__tape">
        <button
          type="button"
          className={`msale__mic${recording ? " is-on" : ""}${transcribing ? " is-busy" : ""}`}
          onClick={() => (recording ? stopRec() : void startRec())}
          disabled={!canRecord || transcribing}
          aria-pressed={recording}
          aria-label={recording ? "Arrêter le dictaphone" : "Dicter la vente"}
        >
          {recording ? (
            <span className="msale__bars" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : (
            <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden>
              <path
                fill="currentColor"
                d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
              />
            </svg>
          )}
        </button>
        <div className="msale__talk-copy">
          <p className="msale__talk-title">{recLabel}</p>
          <p className="msale__hint">
            {heard
              ? `« ${heard} »`
              : canRecord
                ? "Appuyez, dites la vente, appuyez pour arrêter."
                : "Micro indispo — notez à la main."}
          </p>
        </div>
      </div>

      <form
        className="msale__note"
        onSubmit={(e) => {
          e.preventDefault();
          addNote();
        }}
      >
        <label>
          <span>Ou notez à la main</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="2 lait, 1 pain"
            autoComplete="off"
            enterKeyHint="done"
          />
        </label>
        <button type="submit" className="msale__note-go" disabled={!note.trim()}>
          Ajouter
        </button>
      </form>

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
        className="msale__go"
        disabled={pending || !basket.length}
        onClick={submit}
      >
        {pending ? "…" : "C’est vendu"}
      </button>

      <label className="msale__search">
        <span>Ou touchez un produit</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          autoComplete="off"
        />
      </label>

      <ul className="msale__hits">
        {picks.map((p) => {
          const qty = lines.find((l) => l.productId === p.id)?.quantity ?? 0;
          return (
            <li key={p.id}>
              <button type="button" onClick={() => bump(p.id, 1)}>
                <span className="msale__hit-name">{p.name}</span>
                <span className="msale__hit-add">{qty ? qty : "+"}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {recent[0] ? (
        <p className="msale__last">
          Dernière : {recent[0].soldAt} ·{" "}
          {recent[0].items.map((i) => `${i.quantity} ${i.name}`).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
