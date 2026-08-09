"use client";

import { useState, useTransition } from "react";
import { Field, inputClass } from "@/components/ui";

type Provider = "openai" | "anthropic";
type Status =
  | "untested"
  | "valid"
  | "invalid"
  | "revoked"
  | "none"
  | "legacy";

type ConnectorId = "openai" | "anthropic";

type Connector = {
  id: ConnectorId;
  provider?: Provider;
  name: string;
  product: string;
  hint: string;
  keyHint: string;
  docsUrl: string;
  available: boolean;
};

/** Soft-launch : uniquement les connecteurs réellement branchés (pas de « bientôt »). */
const CONNECTORS: Connector[] = [
  {
    id: "openai",
    provider: "openai",
    name: "ChatGPT",
    product: "OpenAI",
    hint: "GPT-4o · clé API OpenAI",
    keyHint: "sk-… ou sk-proj-…",
    docsUrl: "https://platform.openai.com/api-keys",
    available: true,
  },
  {
    id: "anthropic",
    provider: "anthropic",
    name: "Claude",
    product: "Anthropic",
    hint: "Claude · clé API Anthropic",
    keyHint: "sk-ant-…",
    docsUrl: "https://console.anthropic.com/settings/keys",
    available: true,
  },
];

const STATUS_LABEL: Record<Status, string> = {
  untested: "Non testée",
  valid: "Valide",
  invalid: "Invalide",
  revoked: "Révoquée",
  none: "Absente",
  legacy: "Legacy",
};

function ConnectorMark({ id }: { id: ConnectorId }) {
  const letter = id === "openai" ? "G" : "C";
  return (
    <span className={`llm-conn__mark llm-conn__mark--${id}`} aria-hidden>
      {letter}
    </span>
  );
}

export function LlmByokForm({
  initial,
}: {
  initial: {
    configured: boolean;
    provider: Provider | "platform" | null;
    status: Status;
    fingerprintDisplay: string | null;
    source: "byok" | "legacy" | "platform" | null;
  };
}) {
  const initialConnector: ConnectorId =
    initial.provider === "anthropic" ? "anthropic" : "openai";
  const [connectorId, setConnectorId] =
    useState<ConnectorId>(initialConnector);
  const [apiKey, setApiKey] = useState("");
  const [meta, setMeta] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected =
    CONNECTORS.find((c) => c.id === connectorId) || CONNECTORS[0]!;
  const provider = selected.provider;

  function selectConnector(c: Connector) {
    setConnectorId(c.id);
    setError(null);
    setOkMsg(null);
    if (!c.available) {
      setApiKey("");
    }
  }

  function connect() {
    if (!provider || !selected.available) return;
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/settings/llm-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || "Échec de connexion.");
        setApiKey("");
        return;
      }
      setApiKey("");
      setOkMsg(
        "Connecté. La clé est chiffrée — validée au premier message du Copilote."
      );
      setMeta({
        configured: true,
        provider,
        status: "untested",
        fingerprintDisplay:
          provider === "anthropic"
            ? `sk-ant-…${String(data.fingerprint || "")}`
            : `sk-…${String(data.fingerprint || "")}`,
        source: "byok",
      });
    });
  }

  function disconnect() {
    if (!meta.provider || meta.provider === "platform") return;
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const p = meta.provider === "anthropic" ? "anthropic" : "openai";
      const res = await fetch(`/api/settings/llm-credentials/${p}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        setError("Impossible de révoquer la clé.");
        return;
      }
      setOkMsg("Déconnecté — secret effacé côté serveur.");
      setMeta({
        configured: false,
        provider: null,
        status: "none",
        fingerprintDisplay: null,
        source: null,
      });
    });
  }

  const connectedLabel =
    meta.provider === "anthropic"
      ? "Claude"
      : meta.provider === "openai"
        ? "ChatGPT"
        : meta.provider === "platform"
          ? "Plateforme"
          : null;

  return (
    <div className="llm-byok ms-spot__card settings-guided__card">
      <div className="llm-byok__head">
        <div>
          <p className="llm-byok__title">Connecteurs IA</p>
          <p className="llm-byok__lead">
            Choisissez votre outil, collez la clé API — facturée chez le
            provider, pas chez Margin.
          </p>
        </div>
        <span
          className={`llm-byok__badge llm-byok__badge--${meta.status}`}
          title="Statut de la clé"
        >
          {STATUS_LABEL[meta.status]}
        </span>
      </div>

      {meta.configured && meta.fingerprintDisplay ? (
        <p className="llm-byok__fp">
          Connecté · {connectedLabel} · {meta.fingerprintDisplay}
          {meta.source === "legacy" ? " (ancienne clé)" : ""}
        </p>
      ) : (
        <p className="llm-byok__fp llm-byok__fp--muted">
          1 clic sur un connecteur → coller la clé → Enregistrer. Les imports
          CSV/PDF marchent aussi sans clé.
        </p>
      )}

      <div className="llm-conn" role="list" aria-label="Connecteurs IA">
        {CONNECTORS.map((c) => {
          const active = connectorId === c.id;
          const isConnected =
            meta.configured &&
            ((c.provider === "openai" && meta.provider === "openai") ||
              (c.provider === "anthropic" && meta.provider === "anthropic"));
          return (
            <button
              key={c.id}
              type="button"
              role="listitem"
              className={`llm-conn__card${active ? " is-on" : ""}${
                !c.available ? " is-soon" : ""
              }${isConnected ? " is-linked" : ""}`}
              onClick={() => selectConnector(c)}
              aria-pressed={active}
              aria-disabled={!c.available}
            >
              <ConnectorMark id={c.id} />
              <span className="llm-conn__meta">
                <span className="llm-conn__name">{c.name}</span>
                <span className="llm-conn__product">{c.product}</span>
              </span>
              <span className="llm-conn__state">
                {isConnected ? "Lié" : active ? "Choisir" : "Dispo"}
              </span>
            </button>
          );
        })}
      </div>

      {provider ? (
        <>
          <p className="llm-conn__step">
            Clé {selected.name} —{" "}
            <a href={selected.docsUrl} target="_blank" rel="noreferrer">
              créer une clé ici
            </a>
          </p>
          <Field label={`Clé API ${selected.product}`}>
            <input
              className={inputClass}
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={selected.keyHint}
            />
          </Field>

          <div className="llm-byok__actions">
            <button
              type="button"
              className="btn-lime"
              disabled={pending || apiKey.trim().length < 20}
              onClick={connect}
            >
              {pending ? "Connexion…" : `Connecter ${selected.name}`}
            </button>
            {meta.configured && meta.source !== "platform" ? (
              <button
                type="button"
                className="ms-spot__later"
                disabled={pending}
                onClick={disconnect}
              >
                Déconnecter
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {okMsg ? <p className="llm-byok__ok">{okMsg}</p> : null}
      {error ? <p className="llm-byok__err">{error}</p> : null}
    </div>
  );
}
