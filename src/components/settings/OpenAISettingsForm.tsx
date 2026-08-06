"use client";

import { useState, useTransition } from "react";
import { Field, inputClass } from "@/components/ui";
import { updateOpenAISettings, testOpenAIConnection } from "@/app/actions";

export function OpenAISettingsForm({
  configured,
  source,
  maskedKey,
  model,
}: {
  configured: boolean;
  source: "restaurant" | "env" | null;
  maskedKey: string;
  model: string;
}) {
  const [pending, startTransition] = useTransition();
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  return (
    <div className="dash-card dash-card--dark space-y-4">
      <div>
        <p className="text-[15px] font-medium">
          {configured ? "Analyse photo activée" : "Analyse photo non activée"}
        </p>
        <p className="mt-1 text-[13px] text-[var(--text-secondary-dark)]">
          {configured
            ? source === "env"
              ? `Connecté (${maskedKey})`
              : `Clé enregistrée (${maskedKey})`
            : "Sans connexion, Margin estime les fiches produit localement. Pour lire une photo de catalogue, collez une clé sk-…"}
        </p>
      </div>

      <form action={updateOpenAISettings} className="space-y-4">
        <Field label="Clé de connexion (avancé)">
          <input
            name="openaiApiKey"
            className={inputClass}
            type="password"
            autoComplete="off"
            placeholder={configured ? maskedKey || "•••• sk-…" : "sk-…"}
          />
        </Field>
        <Field label="Modèle (laisser par défaut)">
          <input
            name="openaiModel"
            className={inputClass}
            defaultValue={model || "gpt-4o-mini"}
            placeholder="gpt-4o-mini"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="pill-btn pill-btn--primary">
            Enregistrer la clé
          </button>
          {configured && source === "restaurant" ? (
            <button
              type="submit"
              name="clearOpenAI"
              value="1"
              className="pill-btn pill-btn--ghost"
            >
              Effacer la clé
            </button>
          ) : null}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="pill-btn pill-btn--ghost"
          disabled={pending || !configured}
          onClick={() => {
            setTestMsg(null);
            setTestError(null);
            startTransition(async () => {
              const res = await testOpenAIConnection();
              if (!res.ok) {
                setTestError(res.error);
                return;
              }
              setTestMsg(res.message);
            });
          }}
        >
          {pending ? "Test…" : "Tester la connexion"}
        </button>
        {testMsg ? (
          <p className="text-[13px] text-[var(--accent-lime)]">{testMsg}</p>
        ) : null}
        {testError ? (
          <p className="text-[13px] text-red-400">{testError}</p>
        ) : null}
      </div>
    </div>
  );
}
