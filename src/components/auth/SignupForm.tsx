"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Field, inputClass } from "@/components/ui";
import { PLANS, type BillingPeriod, type PlanId } from "@/lib/plans";
import { AFFILIATE } from "@/lib/affiliate";
import {
  requestSignupOtpAction,
  signupAndCheckoutAction,
} from "@/app/actions";

export function SignupForm({
  smsAvailable = false,
}: {
  smsAvailable?: boolean;
}) {
  const searchParams = useSearchParams();
  const initialPlan = (searchParams.get("plan") || "commerce") as PlanId;
  const initialBilling = (searchParams.get("billing") ||
    "monthly") as BillingPeriod;
  const planFromUrl = Boolean(searchParams.get("plan"));
  const referralCode = (searchParams.get("ref") || "").trim();

  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">(
    smsAvailable ? "sms" : "email"
  );
  /** Honeypot — les bots le remplissent, les humains ne le voient pas */
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

  const planMeta = useMemo(
    () => PLANS.find((p) => p.id === plan),
    [plan]
  );

  async function sendOtp() {
    setLoading(true);
    setError(null);
    setInfo(null);
    const res = await requestSignupOtpAction({
      email,
      channel: channel === "sms" && smsAvailable ? "sms" : "email",
      phone: channel === "sms" ? phone : undefined,
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
        : "Code envoyé par email — valable 10 min."
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === "form") {
      if (!name.trim() || !email.trim() || password.length < 8) {
        setError("Nom, email et mot de passe (8+ caractères) requis.");
        return;
      }
      if (channel === "sms" && smsAvailable && !phone.trim()) {
        setError("Indiquez votre numéro pour recevoir le SMS.");
        return;
      }
      await sendOtp();
      return;
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
    <div className="marketing flex min-h-screen items-center justify-center px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="brand-card brand-card--dark-card relative w-full max-w-md space-y-3"
      >
        <h1 className="brand-card__title">Démarrez avec Margin</h1>
        {planMeta ? (
          <p className="brand-card__proof">
            <strong className="signup-plan-name">{planMeta.name}</strong>
            {" — "}
            {planMeta.bestFor}. Sans changer de caisse · −
            {AFFILIATE.discountPercentReferee}&nbsp;% le premier mois.
            {referralCode
              ? ` Parrainage appliqué.`
              : null}
            {step === "form" ? (
              <span className="signup-plan-note">
                {" "}
                Un code à usage unique confirme votre email avant le paiement.
              </span>
            ) : (
              <span className="signup-plan-note">
                {" "}
                Entrez le code reçu, puis on finalise.
              </span>
            )}
          </p>
        ) : (
          <p className="brand-card__proof">
            Sans changer de caisse · −{AFFILIATE.discountPercentReferee}&nbsp;% le
            premier mois.
          </p>
        )}

        {step === "form" ? (
          <>
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
            <Field label="Votre email">
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
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: "-10000px",
                top: "auto",
                width: 1,
                height: 1,
                overflow: "hidden",
              }}
            >
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
            <Field label="Mot de passe (8 caractères min.)">
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

            {smsAvailable ? (
              <div className="space-y-2">
                <p className="text-[12px] opacity-70">Recevoir le code par</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`segmented-tab ${channel === "email" ? "active" : ""}`}
                    onClick={() => setChannel("email")}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    className={`segmented-tab ${channel === "sms" ? "active" : ""}`}
                    onClick={() => setChannel("sms")}
                  >
                    SMS
                  </button>
                </div>
                {channel === "sms" ? (
                  <Field label="Téléphone">
                    <input
                      className={inputClass}
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+33612345678"
                      autoComplete="tel"
                      required
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}

            {!showPlan ? (
              <p className="text-[13px] opacity-80">
                Formule choisie : <strong>{planMeta?.name}</strong>
                {" · "}
                {billingPeriod === "yearly" ? "annuel (−20 %)" : "mensuel"}
                {" · "}
                <button
                  type="button"
                  className="underline opacity-90"
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

            <label className="flex cursor-pointer items-start gap-2 text-[13px] opacity-85">
              <input
                type="checkbox"
                className="mt-1"
                checked={newsletterOptIn}
                onChange={(e) => setNewsletterOptIn(e.target.checked)}
              />
              <span>
                Recevoir les conseils stock Margin (1–2 e-mails / mois).
                Désinscription en 1 clic.
              </span>
            </label>
          </>
        ) : (
          <>
            <p className="text-[13px] opacity-80">
              Code envoyé à{" "}
              <strong>
                {channel === "sms" && smsAvailable ? phone : email}
              </strong>
            </p>
            {devCode ? (
              <p className="flash flash-warn text-[13px]">
                Mode local — code : <strong>{devCode}</strong>
              </p>
            ) : null}
            <Field label="Code à 6 chiffres">
              <input
                className={inputClass}
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                autoComplete="one-time-code"
                placeholder="123456"
                required
              />
            </Field>
            <button
              type="button"
              className="btn-ghost w-full"
              disabled={loading}
              onClick={() => void sendOtp()}
            >
              Renvoyer le code
            </button>
            <button
              type="button"
              className="text-[13px] underline opacity-70"
              onClick={() => {
                setStep("form");
                setOtpCode("");
                setError(null);
                setInfo(null);
              }}
            >
              ← Modifier mes infos
            </button>
          </>
        )}

        {info ? <p className="text-[13px] opacity-80">{info}</p> : null}
        {error ? (
          <p className="text-[14px] text-[var(--accent-lime)]">{error}</p>
        ) : null}
        <button type="submit" className="brand-cta w-full" disabled={loading}>
          {loading
            ? step === "form"
              ? "Envoi…"
              : "Création…"
            : step === "form"
              ? "Commencer"
              : "Créer mon compte"}
        </button>
        <p className="text-center text-[13px] opacity-70">
          Déjà un compte ? <Link href="/login">Se connecter</Link>
        </p>
      </form>
    </div>
  );
}
