"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Field, inputClass } from "@/components/ui";
import { MarginLogo } from "@/components/brand/MarginLogo";
import { PLANS, type BillingPeriod, type PlanId } from "@/lib/plans";
import { AFFILIATE } from "@/lib/affiliate";
import {
  requestSignupOtpAction,
  signupAndCheckoutAction,
} from "@/app/actions";
import "@/components/auth/auth-shell.css";

export function SignupForm({
  smsAvailable = false,
  otpRequired = true,
}: {
  smsAvailable?: boolean;
  otpRequired?: boolean;
}) {
  const searchParams = useSearchParams();
  const initialPlan = (searchParams.get("plan") || "commerce") as PlanId;
  const initialBilling = (searchParams.get("billing") ||
    "monthly") as BillingPeriod;
  const planFromUrl = Boolean(searchParams.get("plan"));
  const referralCode = (searchParams.get("ref") || "").trim();
  const ambassadorCode = (searchParams.get("amb") || "").trim();

  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [website, setWebsite] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [otpCode, setOtpCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanId>(
    ["commerce", "reseau"].includes(initialPlan) ? initialPlan : "commerce"
  );
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(
    initialBilling === "yearly" ? "yearly" : "monthly"
  );
  const [showPlan, setShowPlan] = useState(!planFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const planMeta = useMemo(() => PLANS.find((p) => p.id === plan), [plan]);
  const useSms = channel === "sms" && smsAvailable;

  async function sendOtp() {
    setLoading(true);
    setError(null);
    setInfo(null);
    const res = await requestSignupOtpAction({
      email,
      channel: useSms ? "sms" : "email",
      phone: useSms ? phone : undefined,
      website,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setChallengeId(res.challengeId);
    setDevCode(res.devCode || null);
    setStep("otp");
    setInfo(
      res.channel === "sms"
        ? "Code envoyé par SMS — valable 10 min."
        : "Code envoyé par email — valable 10 min. Pensez aux indésirables."
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === "form") {
      if (!name.trim() || !email.trim() || password.length < 8) {
        setError("Nom, email et mot de passe (8+ caractères) requis.");
        return;
      }
      if (otpRequired) {
        if (useSms && !phone.trim()) {
          setError("Indiquez votre numéro pour recevoir le SMS.");
          return;
        }
        await sendOtp();
        return;
      }
    }

    setLoading(true);
    setError(null);
    const res = await signupAndCheckoutAction({
      name,
      email,
      password,
      plan,
      billingPeriod,
      website,
      referralCode: referralCode || undefined,
      ambassadorCode: ambassadorCode || undefined,
      newsletterOptIn,
      otpCode,
      otpChallengeId: challengeId || undefined,
    });
    if (!res.ok) {
      setLoading(false);
      setError(res.error);
      return;
    }
    if (res.checkoutUrl) {
      window.location.href = res.checkoutUrl;
      return;
    }
    const signed = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (signed?.error) {
      setLoading(false);
      setError("Compte créé — reconnectez-vous depuis Connexion.");
      window.location.href = "/login";
      return;
    }
    window.location.href = res.redirectTo || "/onboarding";
  }

  return (
    <div className="auth-shell">
      <div className="auth-shell__glow" aria-hidden />
      <form onSubmit={onSubmit} className="auth-panel">
        <MarginLogo tone="light" href="/welcome" className="auth-panel__logo" />
        <h1 className="auth-panel__title">
          {step === "form" ? "Créer mon compte" : "Vérification"}
        </h1>
        <p className="auth-panel__lead">
          {step === "form" ? (
            <>
              {planMeta ? (
                <>
                  <strong>{planMeta.name}</strong> — {planMeta.bestFor}. −
                  {AFFILIATE.discountPercentReferee}&nbsp;% le 1<sup>er</sup>{" "}
                  mois.
                  {referralCode ? " Parrainage appliqué." : null}
                </>
              ) : (
                <>Sans changer de caisse.</>
              )}
            </>
          ) : (
            <>
              Entrez le code reçu
              {useSms ? " par SMS" : " par email"} pour finaliser.
            </>
          )}
        </p>

        {step === "form" ? (
          <div className="auth-panel__fields">
            <Field label="Nom du commerce">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Épicerie du coin"
                autoComplete="organization"
                required
              />
            </Field>
            <Field label="Email">
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="vous@email.fr"
                required
              />
            </Field>
            <div className="auth-hp" aria-hidden>
              <label>
                Site web
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>
            <Field label="Mot de passe (8 car. min.)">
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </Field>

            {otpRequired ? (
            <div className="auth-channel">
              <p className="auth-channel__label">Code de confirmation</p>
              <div className="auth-channel__row" role="group">
                <button
                  type="button"
                  className={`auth-channel__btn ${channel === "email" ? "is-on" : ""}`}
                  onClick={() => setChannel("email")}
                >
                  Email
                </button>
                <button
                  type="button"
                  className={`auth-channel__btn ${channel === "sms" ? "is-on" : ""}`}
                  onClick={() => {
                    if (!smsAvailable) {
                      setError(
                        "SMS pas encore activé sur ce serveur. Utilisez l’email."
                      );
                      setChannel("email");
                      return;
                    }
                    setError(null);
                    setChannel("sms");
                  }}
                  aria-disabled={!smsAvailable}
                >
                  SMS
                </button>
              </div>
              {!smsAvailable ? (
                <p className="auth-channel__hint">
                  SMS indisponible pour l’instant — email recommandé.
                </p>
              ) : channel === "sms" ? (
                <Field label="Téléphone mobile">
                  <input
                    className={inputClass}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    autoComplete="tel"
                    required
                  />
                </Field>
              ) : (
                <p className="auth-channel__hint">
                  Le code arrive dans votre boîte (et parfois indésirables).
                </p>
              )}
            </div>
            ) : null}

            {!showPlan ? (
              <p className="auth-plan-line">
                Formule : <strong>{planMeta?.name}</strong>
                {" · "}
                {billingPeriod === "yearly" ? "annuel (−20 %)" : "mensuel"}
                {" · "}
                <button
                  type="button"
                  className="auth-linkish"
                  onClick={() => setShowPlan(true)}
                >
                  Changer
                </button>
              </p>
            ) : (
              <>
                <Field label="Formule">
                  <select
                    className={inputClass}
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as PlanId)}
                  >
                    {PLANS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.priceMonthly} €/mois
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Paiement">
                  <select
                    className={inputClass}
                    value={billingPeriod}
                    onChange={(e) =>
                      setBillingPeriod(e.target.value as BillingPeriod)
                    }
                  >
                    <option value="monthly">Tous les mois</option>
                    <option value="yearly">Une fois par an (−20 %)</option>
                  </select>
                </Field>
              </>
            )}

            <label className="auth-check">
              <input
                type="checkbox"
                checked={newsletterOptIn}
                onChange={(e) => setNewsletterOptIn(e.target.checked)}
              />
              <span>Conseils stock Margin (1–2 e-mails / mois).</span>
            </label>
          </div>
        ) : (
          <div className="auth-panel__fields">
            <p className="auth-plan-line">
              Envoyé à{" "}
              <strong>{useSms ? phone || email : email}</strong>
            </p>
            {devCode ? (
              <p className="auth-devcode">
                Mode local — code : <strong>{devCode}</strong>
              </p>
            ) : null}
            <Field label="Code à 6 chiffres">
              <input
                className={`${inputClass} auth-otp-input`}
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                autoComplete="one-time-code"
                placeholder="••••••"
                required
              />
            </Field>
            <button
              type="button"
              className="auth-secondary"
              disabled={loading}
              onClick={() => void sendOtp()}
            >
              Renvoyer le code
            </button>
            <button
              type="button"
              className="auth-linkish"
              onClick={() => {
                setStep("form");
                setOtpCode("");
                setError(null);
                setInfo(null);
              }}
            >
              ← Modifier mes infos
            </button>
          </div>
        )}

        {info ? <p className="auth-info">{info}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}

        <button type="submit" className="auth-cta" disabled={loading}>
          {loading
            ? step === "form" && otpRequired
              ? "Envoi…"
              : "Création…"
            : step === "form"
              ? otpRequired
                ? "Recevoir mon code"
                : "Créer mon compte"
              : "Créer mon compte"}
        </button>

        <p className="auth-foot">
          Déjà un compte ? <Link href="/login">Se connecter</Link>
        </p>
      </form>
    </div>
  );
}
