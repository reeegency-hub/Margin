"use client";

import { useMemo, useState, useTransition } from "react";
import { Field, inputClass } from "@/components/ui";
import {
  COLD_SEGMENTS,
  COLD_SEQUENCE,
  INFLUENCER_NICHES,
  INFLUENCER_OUTREACH,
  INFLUENCER_PLATFORMS,
  INFLUENCER_STATUSES,
  MARKETING_PLAYBOOK,
  PROSPECT_STATUSES,
  type ColdEmailVars,
} from "@/lib/marketing-playbook";
import {
  advanceProspectSequenceAction,
  createInfluencerAction,
  createProspectAction,
  deleteInfluencerAction,
  deleteProspectAction,
  rescoreInfluencerAction,
  updateInfluencerStatusAction,
  updateProspectStatusAction,
} from "@/app/actions/marketing";

export type ProspectRow = {
  id: string;
  email: string;
  contactName: string | null;
  businessName: string | null;
  city: string | null;
  segment: string;
  posVendor: string | null;
  status: string;
  sequenceStep: number;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
};

export type InfluencerRow = {
  id: string;
  handle: string;
  displayName: string | null;
  platform: string;
  profileUrl: string | null;
  email: string | null;
  city: string | null;
  niche: string;
  followers: number;
  engagementPct: number | null;
  fitScore: number;
  status: string;
  dealType: string | null;
  notes: string | null;
  lastContactedAt: string | null;
};

function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          window.setTimeout(() => setOk(false), 1400);
        } catch {
          /* ignore */
        }
      }}
    >
      {ok ? "Copié" : label}
    </button>
  );
}

function statusLabel(
  list: readonly { id: string; label: string }[],
  id: string
) {
  return list.find((x) => x.id === id)?.label || id;
}

export function MarketingHub({
  prospects,
  influencers,
  dueCount,
  initialTab = "playbook",
}: {
  prospects: ProspectRow[];
  influencers: InfluencerRow[];
  dueCount: number;
  initialTab?: "cold" | "influencers" | "playbook";
}) {
  const [tab, setTab] = useState<"cold" | "influencers" | "playbook">(
    initialTab
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    prospects[0]?.id ?? null
  );
  const [seqStep, setSeqStep] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => prospects.find((p) => p.id === selectedId) || null,
    [prospects, selectedId]
  );

  const emailVars: ColdEmailVars = {
    contactName: selected?.contactName,
    businessName: selected?.businessName,
    city: selected?.city,
    segment: selected?.segment,
    posVendor: selected?.posVendor,
  };

  const step = COLD_SEQUENCE.find((s) => s.step === seqStep) || COLD_SEQUENCE[0];
  const subject = step.subject(emailVars);
  const body = step.body(emailVars);

  const topInfluencers = [...influencers].sort(
    (a, b) => b.fitScore - a.fitScore
  );

  return (
    <div className="space-y-5">
      <div className="segmented-tabs">
        <button
          type="button"
          className={`segmented-tab ${tab === "cold" ? "active" : ""}`}
          onClick={() => setTab("cold")}
        >
          Cold email {dueCount > 0 ? `(${dueCount} dus)` : ""}
        </button>
        <button
          type="button"
          className={`segmented-tab ${tab === "influencers" ? "active" : ""}`}
          onClick={() => setTab("influencers")}
        >
          Micro-influenceurs
        </button>
        <button
          type="button"
          className={`segmented-tab ${tab === "playbook" ? "active" : ""}`}
          onClick={() => setTab("playbook")}
        >
          Playbook
        </button>
      </div>

      {msg ? <p className="flash">{msg}</p> : null}

      {tab === "cold" ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <div className="dash-card dash-card--dark space-y-3">
              <h2 className="text-lg font-semibold">Nouveau prospect</h2>
              <form
                className="grid gap-3 sm:grid-cols-2"
                action={(fd) => {
                  startTransition(async () => {
                    const res = await createProspectAction(fd);
                    setMsg(res.ok ? "Prospect ajouté." : res.error);
                  });
                }}
              >
                <Field label="Email *">
                  <input name="email" type="email" className={inputClass} required />
                </Field>
                <Field label="Contact">
                  <input name="contactName" className={inputClass} placeholder="Prénom" />
                </Field>
                <Field label="Commerce">
                  <input
                    name="businessName"
                    className={inputClass}
                    placeholder="Épicerie du coin"
                  />
                </Field>
                <Field label="Ville">
                  <input name="city" className={inputClass} />
                </Field>
                <Field label="Segment">
                  <select name="segment" className={inputClass} defaultValue="epicerie">
                    {COLD_SEGMENTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Caisse">
                  <input
                    name="posVendor"
                    className={inputClass}
                    placeholder="Zelty, Cashpad…"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Notes">
                    <input name="notes" className={inputClass} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" className="btn-lime" disabled={pending}>
                    Ajouter au pipeline
                  </button>
                </div>
              </form>
            </div>

            <div className="dash-card dash-card--light overflow-x-auto">
              <h2 className="mb-3 text-lg font-semibold">
                Pipeline ({prospects.length})
              </h2>
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-black/10 text-[11px] uppercase opacity-60">
                    <th className="py-2 pr-2">Prospect</th>
                    <th className="py-2 pr-2">Étape</th>
                    <th className="py-2 pr-2">Statut</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p) => {
                    const due =
                      p.nextFollowUpAt &&
                      new Date(p.nextFollowUpAt).getTime() <= Date.now();
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-black/5 cursor-pointer ${
                          selectedId === p.id ? "bg-black/5" : ""
                        }`}
                        onClick={() => {
                          setSelectedId(p.id);
                          setSeqStep(Math.min(3, Math.max(1, p.sequenceStep + 1)));
                        }}
                      >
                        <td className="py-2 pr-2">
                          <strong>{p.businessName || p.email}</strong>
                          <div className="opacity-60 text-[11px]">
                            {p.contactName ? `${p.contactName} · ` : ""}
                            {p.email}
                            {due ? " · à relancer" : ""}
                          </div>
                        </td>
                        <td className="py-2 pr-2">{p.sequenceStep}/3</td>
                        <td className="py-2 pr-2">
                          {statusLabel(PROSPECT_STATUSES, p.status)}
                        </td>
                        <td className="py-2" onClick={(e) => e.stopPropagation()}>
                          <form
                            action={(fd) => {
                              startTransition(async () => {
                                await deleteProspectAction(fd);
                                setMsg("Prospect supprimé.");
                              });
                            }}
                          >
                            <input type="hidden" name="id" value={p.id} />
                            <button type="submit" className="btn-ghost text-[12px]">
                              Suppr.
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {prospects.length === 0 ? (
                <p className="py-4 text-center opacity-60">
                  Aucun prospect — ajoutez-en 15 cette semaine (playbook).
                </p>
              ) : null}
            </div>
          </div>

          <div className="dash-card dash-card--dark space-y-4">
            <h2 className="text-lg font-semibold">Séquence cold (3 touches)</h2>
            {!selected ? (
              <p className="opacity-70 text-[14px]">
                Sélectionnez un prospect pour personnaliser l’email.
              </p>
            ) : (
              <>
                <p className="text-[13px] opacity-70">
                  {selected.businessName || selected.email}
                  {selected.city ? ` · ${selected.city}` : ""}
                  {" · "}
                  touche actuelle {selected.sequenceStep}/3
                </p>
                <div className="flex flex-wrap gap-2">
                  {COLD_SEQUENCE.map((s) => (
                    <button
                      key={s.step}
                      type="button"
                      className={`segmented-tab ${seqStep === s.step ? "active" : ""}`}
                      onClick={() => setSeqStep(s.step)}
                    >
                      T{s.step}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] opacity-60">{step.label}</p>
                <div>
                  <p className="text-[11px] uppercase opacity-50">Objet</p>
                  <p className="mt-1 rounded-[10px] bg-[var(--bg-app)] p-2 font-medium text-[14px]">
                    {subject}
                  </p>
                  <div className="mt-2">
                    <CopyButton text={subject} label="Copier objet" />
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase opacity-50">Corps</p>
                  <pre className="mt-1 whitespace-pre-wrap rounded-[10px] bg-[var(--bg-app)] p-3 text-[13px] leading-relaxed font-sans">
                    {body}
                  </pre>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CopyButton text={`Objet: ${subject}\n\n${body}`} />
                    <a
                      className="btn-lime btn-lime--sm"
                      href={`mailto:${selected.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                    >
                      Ouvrir mail
                    </a>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-3">
                  <form
                    action={(fd) => {
                      startTransition(async () => {
                        const res = await advanceProspectSequenceAction(fd);
                        if (res.ok) {
                          setMsg(`Touche ${res.step} marquée envoyée.`);
                          setSeqStep(Math.min(3, (res.step || 1) + 1));
                        }
                      });
                    }}
                  >
                    <input type="hidden" name="id" value={selected.id} />
                    <button type="submit" className="btn-lime" disabled={pending}>
                      Marquer touche envoyée
                    </button>
                  </form>
                  <form
                    className="flex items-end gap-2"
                    action={(fd) => {
                      startTransition(async () => {
                        await updateProspectStatusAction(fd);
                        setMsg("Statut mis à jour.");
                      });
                    }}
                  >
                    <input type="hidden" name="id" value={selected.id} />
                    <Field label="Statut">
                      <select
                        name="status"
                        className={inputClass}
                        defaultValue={selected.status}
                      >
                        {PROSPECT_STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <button type="submit" className="btn-ghost">
                      OK
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {tab === "influencers" ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="dash-card dash-card--dark space-y-3">
            <h2 className="text-lg font-semibold">Ajouter un créateur</h2>
            <p className="text-[13px] opacity-70">
              Cible micro : 5k–80k, niche retail / food / gérant. Score fit auto.
            </p>
            <form
              className="grid gap-3 sm:grid-cols-2"
              action={(fd) => {
                startTransition(async () => {
                  const res = await createInfluencerAction(fd);
                  setMsg(
                    res.ok
                      ? `Créateur ajouté — fit ${res.fitScore}/100.`
                      : res.error
                  );
                });
              }}
            >
              <Field label="Pseudo *">
                <input name="handle" className={inputClass} placeholder="commerce_du_coin" required />
              </Field>
              <Field label="Nom affiché">
                <input name="displayName" className={inputClass} />
              </Field>
              <Field label="Plateforme">
                <select name="platform" className={inputClass} defaultValue="instagram">
                  {INFLUENCER_PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Niche">
                <select name="niche" className={inputClass} defaultValue="retail">
                  {INFLUENCER_NICHES.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Abonnés">
                <input name="followers" type="number" min={0} className={inputClass} defaultValue={10000} />
              </Field>
              <Field label="Engagement %">
                <input
                  name="engagementPct"
                  className={inputClass}
                  placeholder="3.5"
                />
              </Field>
              <Field label="URL profil">
                <input name="profileUrl" className={inputClass} placeholder="https://" />
              </Field>
              <Field label="Email">
                <input name="email" type="email" className={inputClass} />
              </Field>
              <Field label="Ville">
                <input name="city" className={inputClass} />
              </Field>
              <Field label="Deal">
                <select name="dealType" className={inputClass} defaultValue="barter">
                  <option value="barter">Barter (abo)</option>
                  <option value="affiliate">Affiliation</option>
                  <option value="paid">Payant</option>
                  <option value="gift">Cadeau</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <input name="notes" className={inputClass} placeholder="Audience, ton, idée de format…" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="btn-lime" disabled={pending}>
                  Enregistrer + scorer
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="dash-card dash-card--light space-y-3">
              <h2 className="text-lg font-semibold">
                Pipeline créateurs ({influencers.length})
              </h2>
              {topInfluencers.length === 0 ? (
                <p className="opacity-60 text-[14px]">
                  Aucun profil — visez 3 scorés / semaine (playbook).
                </p>
              ) : (
                <ul className="space-y-3">
                  {topInfluencers.map((inf) => {
                    const outreach = INFLUENCER_OUTREACH.body({
                      handle: inf.handle,
                      displayName: inf.displayName,
                      niche: inf.niche,
                      followers: inf.followers,
                    });
                    const subject = INFLUENCER_OUTREACH.subject(inf.handle);
                    return (
                      <li
                        key={inf.id}
                        className="rounded-[12px] border border-black/8 p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <strong>
                              @{inf.handle}
                              {inf.displayName ? ` · ${inf.displayName}` : ""}
                            </strong>
                            <div className="text-[12px] opacity-60">
                              {statusLabel(INFLUENCER_PLATFORMS, inf.platform)} ·{" "}
                              {inf.followers.toLocaleString("fr-FR")} · eng.{" "}
                              {inf.engagementPct ?? "—"}% ·{" "}
                              {statusLabel(INFLUENCER_NICHES, inf.niche)}
                            </div>
                          </div>
                          <span
                            className={`admin-badge ${
                              inf.fitScore >= 70
                                ? ""
                                : inf.fitScore >= 50
                                  ? "is-warn"
                                  : "is-muted"
                            }`}
                          >
                            Fit {inf.fitScore}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {inf.profileUrl ? (
                            <a
                              href={inf.profileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost text-[12px]"
                            >
                              Profil
                            </a>
                          ) : null}
                          <CopyButton text={`Objet: ${subject}\n\n${outreach}`} label="Copier outreach" />
                          {inf.email ? (
                            <a
                              className="btn-lime btn-lime--sm"
                              href={`mailto:${inf.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(outreach)}`}
                            >
                              Mail
                            </a>
                          ) : null}
                          <form
                            action={(fd) => {
                              startTransition(async () => {
                                await updateInfluencerStatusAction(fd);
                                setMsg("Statut créateur mis à jour.");
                              });
                            }}
                            className="flex gap-1"
                          >
                            <input type="hidden" name="id" value={inf.id} />
                            <select
                              name="status"
                              className={inputClass}
                              defaultValue={inf.status}
                              style={{ minHeight: 36, fontSize: 12 }}
                            >
                              {INFLUENCER_STATUSES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className="btn-ghost text-[12px]">
                              OK
                            </button>
                          </form>
                          <form
                            action={(fd) => {
                              startTransition(async () => {
                                await rescoreInfluencerAction(fd);
                              });
                            }}
                          >
                            <input type="hidden" name="id" value={inf.id} />
                            <button type="submit" className="btn-ghost text-[12px]">
                              Rescore
                            </button>
                          </form>
                          <form
                            action={(fd) => {
                              startTransition(async () => {
                                await deleteInfluencerAction(fd);
                                setMsg("Créateur retiré.");
                              });
                            }}
                          >
                            <input type="hidden" name="id" value={inf.id} />
                            <button type="submit" className="btn-ghost text-[12px]">
                              Suppr.
                            </button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "playbook" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="dash-card dash-card--light space-y-2">
            <h2 className="text-lg font-semibold">ICP à viser</h2>
            <ul className="list-disc space-y-1 pl-5 text-[14px]">
              {MARKETING_PLAYBOOK.icp.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="dash-card dash-card--light space-y-2">
            <h2 className="text-lg font-semibold">Cadence hebdo</h2>
            <ul className="list-disc space-y-1 pl-5 text-[14px]">
              {MARKETING_PLAYBOOK.weeklyCadence.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="dash-card dash-card--light space-y-2">
            <h2 className="text-lg font-semibold">Sources prospects</h2>
            <ul className="list-disc space-y-1 pl-5 text-[14px]">
              {MARKETING_PLAYBOOK.sources.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="dash-card dash-card--light space-y-2">
            <h2 className="text-lg font-semibold">Critères micro-influenceurs</h2>
            <ul className="list-disc space-y-1 pl-5 text-[14px]">
              {MARKETING_PLAYBOOK.influencerCriteria.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
