import Link from "next/link";
import type { Deal, FollowUp, Lead, SiteVisit, UserProfile } from "@/lib/db-types";
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
  const [{ data: leads }, { data: followUps }, { data: siteVisits }, { data: deals }, { data: users }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id, source, source_platform, city, pipeline_stage, lead_status, score_bucket, lead_priority, assigned_to, created_at")
        .eq("company_id", actor.profile.company_id)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(10000),
      supabase
        .from("follow_ups")
        .select("id, lead_id, assigned_user_id, status, due_at, created_at, completed_at")
        .eq("company_id", actor.profile.company_id)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(10000),
      supabase
        .from("site_visits")
        .select("id, assigned_sales_user_id, visit_status, visit_date, created_at")
        .eq("company_id", actor.profile.company_id)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(10000),
      supabase
        .from("deals")
        .select("id, lead_id, deal_status, deal_value, created_at")
        .eq("company_id", actor.profile.company_id)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(10000),
      supabase.from("user_profiles").select("id, full_name").eq("company_id", actor.profile.company_id)
    ]);

  const summary = buildReportSummary(
    (leads ?? []) as Lead[],
    (followUps ?? []) as FollowUp[],
    (siteVisits ?? []) as SiteVisit[],
    (deals ?? []) as Deal[],
    (users ?? []) as Array<Pick<UserProfile, "id" | "full_name">>
  );

  const hasNoData = summary.totalLeads === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">
            Actionable lead, follow-up, site visit, and conversion insights.
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
            href={`/api/reports/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=csv`}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Export CSV
          </Link>
          <Link
            href={`/api/reports/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=xlsx`}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white"
          >
            Export Excel
          </Link>
        </form>
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        {[
          { label: "Total Leads", value: summary.totalLeads },
          { label: "Open Leads", value: summary.openLeads },
          { label: "Hot Leads", value: summary.hotLeads },
          { label: "Overdue Follow-ups", value: summary.overdueFollowUps },
          { label: "Visits Completed", value: summary.siteVisitsCompleted },
          { label: "Conversion Rate", value: `${summary.conversionRate}%` },
          { label: "Won/Closed Deals", value: summary.wonDeals },
          { label: "Deal Value", value: Number(summary.totalDealValue).toLocaleString() },
          { label: "Follow-up Completion", value: `${summary.followUpCompletionRate}%` },
          { label: "Avg Response (hrs)", value: summary.avgResponseHours }
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{card.value}</p>
          </article>
        ))}
      </section>

      {hasNoData ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <h2 className="text-lg font-bold text-slate-900">No report data yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create leads and activities first. This report will automatically populate with real metrics.
          </p>
          <div className="mt-4">
            <Link href="/leads" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
              Create Lead
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Lead Performance</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By source</p>
                <ul className="space-y-1 text-sm">
                  {summary.sourceCounts.map((item) => (
                    <li key={item.key} className="flex justify-between">
                      <span>{item.key}</span>
                      <span className="font-semibold">{item.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By city</p>
                <ul className="space-y-1 text-sm">
                  {summary.cityCounts.map((item) => (
                    <li key={item.key} className="flex justify-between">
                      <span>{item.key}</span>
                      <span className="font-semibold">{item.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Stage Funnel</p>
              <ul className="space-y-1 text-sm">
                {summary.stageCounts.map((item) => (
                  <li key={item.key} className="flex justify-between">
                    <span>{formatStageLabel(item.key)}</span>
                    <span className="font-semibold">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Follow-up & Visit Performance</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Pending Follow-ups</span>
                <span className="font-semibold">{summary.pendingFollowUps}</span>
              </li>
              <li className="flex justify-between">
                <span>Completed Follow-up %</span>
                <span className="font-semibold">{summary.followUpCompletionRate}%</span>
              </li>
              <li className="flex justify-between">
                <span>Scheduled Visits</span>
                <span className="font-semibold">{summary.siteVisitsScheduled}</span>
              </li>
              <li className="flex justify-between">
                <span>No-show Visits</span>
                <span className="font-semibold">{summary.siteVisitsNoShow}</span>
              </li>
              <li className="flex justify-between">
                <span>Cancelled Visits</span>
                <span className="font-semibold">{summary.siteVisitsCancelled}</span>
              </li>
            </ul>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Lead Aging Buckets</p>
              <ul className="space-y-1 text-sm">
                {summary.leadAgingBuckets.map((item) => (
                  <li key={item.key} className="flex justify-between">
                    <span>{item.key}</span>
                    <span className="font-semibold">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Assignee Performance</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Leads</th>
                    <th className="px-3 py-2">Follow-ups Completed</th>
                    <th className="px-3 py-2">Visits Completed</th>
                    <th className="px-3 py-2">Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.assigneePerformance.map((item) => (
                    <tr key={item.userId} className="border-b border-slate-100">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2">{item.leads}</td>
                      <td className="px-3 py-2">{item.followUpsCompleted}</td>
                      <td className="px-3 py-2">{item.visitsCompleted}</td>
                      <td className="px-3 py-2">{item.conversions}</td>
                    </tr>
                  ))}
                  {summary.assigneePerformance.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={5}>
                        No assignee performance data for selected range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
