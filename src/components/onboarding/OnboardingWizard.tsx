"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProposedDish } from "@/lib/menu-ai";
import {
  saveOnboardingWhatsApp,
  testOnboardingWhatsApp,
  completeOnboarding,
  analyzeMenuAction,
  uploadMenuFileAction,
  confirmMenuRecipesAction,
} from "@/app/actions";
import { Field, inputClass } from "@/components/ui";
import type { BillingPeriod, PlanId } from "@/lib/plans";
import { PLANS } from "@/lib/plans";

type StepId = "whatsapp" | "produits" | "pret";

const STEPS: {
  id: StepId;
  label: string;
  short: string;
  blurb: string;
  minutes: string;
}[] = [
  {
    id: "whatsapp",
    label: "WhatsApp du commerce",
    short: "WhatsApp",
    blurb: "Pour les alertes rupture — comme un SMS.",
    minutes: "30 s",
  },
  {
    id: "produits",
    label: "Votre stock",
    short: "Stock",
    blurb: "Photo, PDF, ou passez — la caisse peut suffire.",
    minutes: "1 min",
  },
  {
    id: "pret",
    label: "Votre caisse",
    short: "Suite",
    blurb: "Ensuite on vous guide pour brancher la caisse.",
    minutes: "10 s",
  },
];

/** Chemin après l’onboarding — visible pour rassurer */
const AFTER_PATH = [
  { label: "Votre équipe", hint: "Planning et pointage" },
  { label: "Votre caisse", hint: "Indiquer votre logiciel" },
];

export type OnboardingInitial = {
  restaurantName: string;
  staffSalle: number;
  staffCuisine: number;
  staffLivreur: number;
  platforms: string[];
  procurementMode: string | null;
  whatsappTo: string;
  dishCount: number;
  openaiConfigured: boolean;
  plan: PlanId | null;
  billingPeriod: BillingPeriod | null;
};

function normalizeFrMobile(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^0[67]\d{8}$/.test(digits)) return `+33${digits.slice(1)}`;
  if (/^\+330[67]\d{8}$/.test(digits)) return `+33${digits.slice(4)}`;
  if (/^33[67]\d{8}$/.test(digits)) return `+${digits}`;
  return digits.startsWith("+") ? digits : raw.trim();
}

export function OnboardingWizard({ initial }: { initial: OnboardingInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [entered, setEntered] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [whatsapp, setWhatsapp] = useState(initial.whatsappTo);
  const [waMsg, setWaMsg] = useState<string | null>(null);
  const [waSaved, setWaSaved] = useState(Boolean(initial.whatsappTo?.trim()));

  const [menuText, setMenuText] = useState("");
  const [dishes, setDishes] = useState<ProposedDish[]>([]);
  const [menuEngine, setMenuEngine] = useState<"openai" | "local" | null>(null);
  const [menuSaved, setMenuSaved] = useState(initial.dishCount > 0);
  const [dragOver, setDragOver] = useState(false);

  const planLabel = initial.plan
    ? PLANS.find((p) => p.id === initial.plan)?.name ?? initial.plan
    : null;
  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;
  const remainingMin = STEPS.slice(step).reduce((acc, s, i) => {
    const n = parseFloat(s.minutes) || 0.5;
    return acc + (i === 0 ? n : n);
  }, 0);

  useEffect(() => {
    setEntered(false);
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, [step]);

  function goNext() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goPrev() {
    if (pending) return;
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function saveWhatsAppAndNext(skip = false) {
    setError(null);
    setWaMsg(null);
    startTransition(async () => {
      const phone = skip ? "" : normalizeFrMobile(whatsapp);
      if (!skip && phone && !/^\+\d{10,15}$/.test(phone)) {
        setError("Indiquez un mobile valide (ex. 06 12 34 56 78).");
        return;
      }
      const res = await saveOnboardingWhatsApp(phone);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!skip && phone) {
        setWhatsapp(phone);
        setWaSaved(true);
      }
      goNext();
    });
  }

  function analyzeMenu() {
    if (!menuText.trim()) {
      setError("Collez votre liste de prix, ou déposez un fichier.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await analyzeMenuAction(menuText);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDishes(res.dishes);
      setMenuEngine(res.engine);
    });
  }

  function onDropFile(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadMenuFileAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMenuText(res.extractedText);
      setDishes(res.dishes);
      setMenuEngine(res.engine);
    });
  }

  function confirmMenuAndNext() {
    if (!dishes.length) {
      goNext();
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await confirmMenuRecipesAction(dishes);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMenuSaved(true);
      goNext();
    });
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const res = await completeOnboarding();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="ob-page">
      <header className="ob-header">
        <div className="ob-logo">Margin</div>
        <p className="ob-commerce">{initial.restaurantName}</p>
      </header>

      {/* Chemin de progression — compte déjà fait + étapes + suite */}
      <div className="ob-journey" aria-label="Votre parcours">
        <div className="ob-journey__meta">
          <span className="ob-journey__chip">Compte créé</span>
          <span className="ob-journey__time">
            Encore ~{Math.max(1, Math.ceil(remainingMin))} min
          </span>
        </div>

        <ol className="ob-path">
          <li className="ob-path__node is-done">
            <span className="ob-path__dot" aria-hidden>
              ✓
            </span>
            <span className="ob-path__label">Compte</span>
          </li>
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`ob-path__node${
                i === step ? " is-active" : i < step ? " is-done" : " is-todo"
              }`}
            >
              <span className="ob-path__dot" aria-hidden>
                {i < step ? "✓" : i + 1}
              </span>
              <span className="ob-path__label">{s.short}</span>
            </li>
          ))}
          {AFTER_PATH.map((s) => (
            <li key={s.label} className="ob-path__node is-later">
              <span className="ob-path__dot" aria-hidden>
                ·
              </span>
              <span className="ob-path__label">{s.label}</span>
            </li>
          ))}
        </ol>

      <div className="ob-progress" aria-hidden>
        <i style={{ width: `${progress}%` }} />
        </div>
        <p className="ob-journey__here">
          <strong>Vous êtes ici :</strong> {current.label} — {current.blurb}
        </p>
        {step < STEPS.length - 1 ? (
          <p className="ob-journey__next">
            Ensuite :{" "}
            {STEPS.slice(step + 1)
              .map((s) => s.short)
              .join(" → ")}
            {AFTER_PATH.length
              ? ` → puis ${AFTER_PATH.map((s) => s.label).join(" & ")}`
              : ""}
          </p>
        ) : (
          <p className="ob-journey__next">
            Ensuite à l’accueil :{" "}
            {AFTER_PATH.map((s) => s.label).join(" → ")}
          </p>
        )}
      </div>

      <main
        className={`ob-card${entered ? " is-entered" : ""}`}
        key={current.id}
      >
        {error ? <p className="ob-error">{error}</p> : null}

        {step === 0 ? (
          <section>
            <p className="ob-step-kicker">Étape 1 sur 3 · {current.minutes}</p>
            <h1>Votre numéro WhatsApp</h1>
            <p className="ob-lead">
              C’est le numéro du commerce ou du gérant. Margin y envoie les
              alertes rupture et la liste de courses — comme un SMS.
            </p>
            <Field label="Mobile (06… ou +33…)">
              <input
                className={inputClass}
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="06 12 34 56 78"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>
            {waMsg ? <p className="ob-ok">{waMsg}</p> : null}
            <div className="ob-actions">
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                disabled={pending || !whatsapp.trim()}
                onClick={() => {
                  setWaMsg(null);
                  setError(null);
                  startTransition(async () => {
                    const phone = normalizeFrMobile(whatsapp);
                    if (!/^\+\d{10,15}$/.test(phone)) {
                      setError(
                        "Indiquez un mobile valide (ex. 06 12 34 56 78)."
                      );
                      return;
                    }
                    await saveOnboardingWhatsApp(phone);
                    setWhatsapp(phone);
                    const res = await testOnboardingWhatsApp();
                    if (!res.ok) {
                      setError(res.error);
                      return;
                    }
                    setWaSaved(true);
                    setWaMsg(res.message);
                  });
                }}
              >
                Envoyer un test
              </button>
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                disabled={pending}
                onClick={() => saveWhatsAppAndNext(true)}
              >
                Plus tard
              </button>
              <button
                type="button"
                className="ob-btn ob-btn--primary"
                disabled={pending}
                onClick={() => saveWhatsAppAndNext(false)}
              >
                Continuer
              </button>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section>
            <p className="ob-step-kicker">Étape 2 sur 3 · {current.minutes}</p>
            <h1>Vos produits (optionnel)</h1>
            <p className="ob-lead">
              Photo ou PDF de votre liste de prix, ou quelques lignes à coller.
              Sinon passez — les produits arriveront aussi via la caisse.
            </p>

            <div
              className={`ob-drop${dragOver ? " is-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) onDropFile(file);
              }}
            >
              <p>Déposez une photo ou un PDF</p>
              <label className="ob-btn ob-btn--ghost ob-btn--sm">
                Choisir un fichier
                <input
                  type="file"
                  accept=".pdf,image/*,.txt"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onDropFile(file);
                  }}
                />
              </label>
            </div>

            <Field label="Ou collez quelques produits">
              <textarea
                className={`${inputClass} min-h-[140px]`}
                value={menuText}
                onChange={(e) => setMenuText(e.target.value)}
                placeholder={"Lait 1L 1,20€\nPain 1,00€\nŒufs x6 2,50€"}
              />
            </Field>

            <div className="ob-actions">
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                disabled={pending}
                onClick={analyzeMenu}
              >
                {pending ? "Analyse…" : "Analyser ma liste"}
              </button>
            </div>

            {dishes.length > 0 ? (
              <div className="ob-menu-list">
                <p className="ob-meta">
                  {dishes.length} produits trouvés
                  {menuEngine === "openai" ? " · analyse auto" : ""}
                </p>
                {dishes.slice(0, 8).map((d, i) => (
                  <article key={`${d.name}-${i}`} className="ob-dish">
                    <div className="ob-dish__head">
                      <strong>{d.name}</strong>
                      <span>{d.salePrice.toFixed(2)} €</span>
                    </div>
                  </article>
                ))}
                {dishes.length > 8 ? (
                  <p className="ob-meta">… et {dishes.length - 8} autres</p>
                ) : null}
              </div>
            ) : null}

            <div className="ob-actions">
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                disabled={pending}
                onClick={goPrev}
              >
                Précédent
              </button>
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                disabled={pending}
                onClick={goNext}
              >
                Passer
              </button>
              <button
                type="button"
                className="ob-btn ob-btn--primary"
                disabled={pending}
                onClick={confirmMenuAndNext}
              >
                {dishes.length ? "Enregistrer" : "Continuer"}
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <p className="ob-step-kicker">Étape 3 sur 3 · dernière</p>
            <h1>C’est bon, {initial.restaurantName}</h1>
            <p className="ob-lead">
              Votre espace est prêt. À l’accueil, on vous montre exactement quoi
              faire ensuite — caisse, puis un petit réassort test.
            </p>
            <ul className="ob-recap">
              {planLabel ? (
                <li>
                  <strong>Formule</strong> — {planLabel}
                  {initial.billingPeriod === "yearly" ? " (annuel)" : ""}
                </li>
              ) : null}
              <li>
                <strong>WhatsApp</strong> —{" "}
                {waSaved || whatsapp
                  ? whatsapp || "Enregistré"
                  : "À ajouter à l’accueil"}
              </li>
              <li>
                <strong>Produits</strong> —{" "}
                {menuSaved || dishes.length
                  ? `${dishes.length || initial.dishCount || "ok"} en catalogue`
                  : "Via la caisse ou plus tard"}
              </li>
            </ul>

            <div className="ob-ahead">
              <p className="ob-ahead__title">Votre suite juste après</p>
              <ol className="ob-ahead__list">
                {AFTER_PATH.map((s, i) => (
                  <li key={s.label}>
                    <span>{i + 1}</span>
                    <div>
                      <strong>{s.label}</strong>
                      <em>{s.hint}</em>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="ob-actions">
              <button
                type="button"
                className="ob-btn ob-btn--ghost"
                disabled={pending}
                onClick={goPrev}
              >
                Précédent
              </button>
              <button
                type="button"
                className="ob-btn ob-btn--primary"
                disabled={pending}
                onClick={finish}
              >
                {pending ? "Ouverture…" : "Entrer dans mon commerce"}
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
