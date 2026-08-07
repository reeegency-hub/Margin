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

const STATUS_LABEL: Record<Status, string> = {
  untested: "Non testée",
  valid: "Valide",
  invalid: "Invalide",
  revoked: "Révoquée",
  none: "Absente",
  legacy: "Legacy",
};

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
  const [provider, setProvider] = useState<Provider>(
    initial.provider === "anthropic" ? "anthropic" : "openai"
  );
  const [apiKey, setApiKey] = useState("");
  const [meta, setMeta] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function connect() {
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
        "Clé enregistrée (chiffrée). Statut : non testée — validée au premier usage."
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
      setOkMsg("Clé révoquée — secret effacé côté serveur.");
      setMeta({
        configured: false,
        provider: null,
        status: "none",
        fingerprintDisplay: null,
        source: null,
      });
    });
  }

  return (
    <div className="llm-byok ms-spot__card settings-guided__card">
      <div className="llm-byok__head">
        <div>
          <p className="llm-byok__title">Connecter mon IA</p>
          <p className="llm-byok__lead">
            Votre clé Anthropic ou OpenAI — facturée sur votre compte provider.
            Jamais renvoyée au navigateur après enregistrement.
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
          {meta.provider === "anthropic"
            ? "Anthropic"
            : meta.provider === "openai"
              ? "OpenAI"
              : "Plateforme"}{" "}
          · {meta.fingerprintDisplay}
          {meta.source === "legacy" ? " (ancienne clé)" : ""}
        </p>
      ) : (
        <p className="llm-byok__fp llm-byok__fp--muted">
          Sans clé : les imports CSV/PDF restent possibles ; le chat libre
          demande une clé Anthropic ou OpenAI (facturée sur votre compte).
        </p>
      )}

      <div className="llm-byok__providers" role="group" aria-label="Provider">
        <button
          type="button"
          className={`llm-byok__prov${provider === "openai" ? " is-on" : ""}`}
          onClick={() => setProvider("openai")}
        >
          OpenAI
        </button>
        <button
          type="button"
          className={`llm-byok__prov${provider === "anthropic" ? " is-on" : ""}`}
          onClick={() => setProvider("anthropic")}
        >
          Anthropic
        </button>
      </div>

      <Field label="Clé API">
        <input
          className={inputClass}
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            provider === "anthropic" ? "sk-ant-…" : "sk-… ou sk-proj-…"
          }
        />
      </Field>

      <div className="llm-byok__actions">
        <button
          type="button"
          className="btn-lime"
          disabled={pending || apiKey.trim().length < 20}
          onClick={connect}
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
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

      {okMsg ? <p className="llm-byok__ok">{okMsg}</p> : null}
      {error ? <p className="llm-byok__err">{error}</p> : null}
    </div>
  );
}
