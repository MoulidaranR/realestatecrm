import Link from "next/link";
import type { Deal, FollowUp, Lead, SiteVisit } from "@/lib/db-types";
import { buildReportSummary } from "@/lib/reporting";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatStageLabel } from "@/lib/lead-options";

type ReportsPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const actor = await getActorContext();
  await requirePermission(actor, "reports.view");
  const params = await searchParams;

  const now = new Date();
  const defaultFromDate = new Date(now);
  defaultFromDate.setDate(defaultFromDate.getDate() - 30);
  const from = params.from?.trim() || defaultFromDate.toISOString().slice(0, 10);
  const to = params.to?.trim() || now.toISOString().slice(0, 10);
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;

  const supabase = await createServerSupabaseClient();
  const [{ data: leads }, { data: followUps }, { data: siteVisits }, { data: deals }] = await Promise.all([
    supabase
      .from("leads")
      .select("source, pipeline_stage, lead_status, score_bucket, created_at")
      .eq("company_id", actor.profile.company_id)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .limit(5000),
    supabase
      .from("follow_ups")
      .select("status, due_at")
      .eq("company_id", actor.profile.company_id)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .limit(5000),
    supabase
      .from("site_visits")
      .select("visit_status")
      .eq("company_id", actor.profile.company_id)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .limit(5000),
    supabase
      .from("deals")
      .select("deal_value")
      .eq("company_id", actor.profile.company_id)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .limit(5000)
  ]);

  const typedLeads = (leads ?? []) as Lead[];
  const typedFollowUps = (followUps ?? []) as FollowUp[];
  const typedSiteVisits = (siteVisits ?? []) as SiteVisit[];
  const typedDeals = (deals ?? []) as Deal[];
  const summary = buildReportSummary(typedLeads, typedFollowUps, typedSiteVisits, typedDeals);

  const sourceCounts = typedLeads.reduce<Record<string, number>>((acc, lead) => {
    const source = lead.source || "unknown";
    acc[source] = (acc[source] ?? 0) + 1;
    return acc;
  }, {});
  const stageCounts = typedLeads.reduce<Record<string, number>>((acc, lead) => {
    acc[lead.pipeline_stage] = (acc[lead.pipeline_stage] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">
            Conversion, follow-up, site visit, and deal performance with export support.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            From
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            To
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Apply
          </button>
          <Link
            href={`/api/reports/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white"
          >
            Export CSV
          </Link>
        </form>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total leads", value: summary.totalLeads },
          { label: "Hot leads", value: summary.hotLeads },
          { label: "Pending follow-ups", value: summary.pendingFollowUps },
          { label: "Site visits completed", value: summary.siteVisitsCompleted },
          { label: "Conversion rate", value: `${summary.conversionRate}%` }
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Leads by source</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            {Object.entries(sourceCounts).map(([source, count]) => (
              <li key={source} className="flex items-center justify-between">
                <span>{source}</span>
                <span className="font-semibold">{count}</span>
              </li>
            ))}
            {Object.keys(sourceCounts).length === 0 ? <li>No source data yet.</li> : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Leads by stage</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            {Object.entries(stageCounts).map(([stage, count]) => (
              <li key={stage} className="flex items-center justify-between">
                <span>{formatStageLabel(stage)}</span>
                <span className="font-semibold">{count}</span>
              </li>
            ))}
            {Object.keys(stageCounts).length === 0 ? <li>No stage data yet.</li> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
