import Link from "next/link";
import { MARKETING_PLAYBOOK } from "@/lib/marketing-playbook";

export function FounderAcquisitionPanel({
  prospectCount = 0,
  dueCount = 0,
  influencerCount = 0,
}: {
  prospectCount?: number;
  dueCount?: number;
  influencerCount?: number;
}) {
  return (
    <section
      className="dash-card dash-card--dark space-y-5 mb-6"
      id="acquisition"
      aria-labelledby="acquisition-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="acquisition-title" className="text-lg font-semibold">
            Acquisition · cold email &amp; influence
          </h2>
          <p className="mt-1 text-[13px] opacity-70">
            Envoi manuel (copier / mail) pour la délivrabilité. Resend / Instantly
            plus tard.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/marketing?tab=cold" className="btn-lime btn-lime--sm">
            Cold email
            {dueCount > 0 ? ` · ${dueCount} dus` : ""}
          </Link>
          <Link
            href="/admin/marketing?tab=influencers"
            className="btn-ghost"
          >
            Influenceurs
            {influencerCount > 0 ? ` · ${influencerCount}` : ""}
          </Link>
          <Link href="/admin/marketing?tab=playbook" className="btn-ghost">
            Playbook
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-[13px]">
        <div className="rounded-[12px] bg-[var(--bg-app)] p-3">
          <p className="opacity-60 text-[11px] uppercase tracking-wide">
            Pipeline
          </p>
          <p className="text-[20px] font-bold">{prospectCount} prospects</p>
        </div>
        <div className="rounded-[12px] bg-[var(--bg-app)] p-3">
          <p className="opacity-60 text-[11px] uppercase tracking-wide">
            Relances
          </p>
          <p className="text-[20px] font-bold">{dueCount} dues</p>
        </div>
        <div className="rounded-[12px] bg-[var(--bg-app)] p-3">
          <p className="opacity-60 text-[11px] uppercase tracking-wide">
            Créateurs
          </p>
          <p className="text-[20px] font-bold">{influencerCount}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 text-[14px]">
        <div>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide opacity-60">
            ICP
          </h3>
          <ul className="list-disc space-y-1 pl-5 opacity-90">
            {MARKETING_PLAYBOOK.icp.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide opacity-60">
            Cadence hebdo
          </h3>
          <ul className="list-disc space-y-1 pl-5 opacity-90">
            {MARKETING_PLAYBOOK.weeklyCadence.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide opacity-60">
            Sources
          </h3>
          <ul className="list-disc space-y-1 pl-5 opacity-90">
            {MARKETING_PLAYBOOK.sources.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide opacity-60">
            Critères micro-influenceurs
          </h3>
          <ul className="list-disc space-y-1 pl-5 opacity-90">
            {MARKETING_PLAYBOOK.influencerCriteria.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
