import Link from "next/link";
import type { Deal, FollowUp, Lead, SiteVisit, UserProfile } from "@/lib/db-types";
import { buildReportSummary } from "@/lib/reporting";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatStageLabel } from "@/lib/lead-options";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

type ReportsPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
};

function BarRow({ label, value, max, color = "bg-primary-500" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="w-28 flex-shrink-0 truncate text-xs text-text-secondary capitalize">{label.replace(/_/g, " ")}</p>
      <div className="flex-1 rounded-full bg-slate-100 h-2">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 flex-shrink-0 text-right text-xs font-semibold text-text-primary">{value}</span>
    </div>
  );
}

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
      supabase.from("leads").select("id, source, source_platform, city, pipeline_stage, lead_status, score_bucket, lead_priority, assigned_to, created_at").eq("company_id", actor.profile.company_id).gte("created_at", fromIso).lte("created_at", toIso).limit(10000),
      supabase.from("follow_ups").select("id, lead_id, assigned_user_id, status, due_at, created_at, completed_at").eq("company_id", actor.profile.company_id).gte("created_at", fromIso).lte("created_at", toIso).limit(10000),
      supabase.from("site_visits").select("id, assigned_sales_user_id, visit_status, visit_date, created_at").eq("company_id", actor.profile.company_id).gte("created_at", fromIso).lte("created_at", toIso).limit(10000),
      supabase.from("deals").select("id, lead_id, deal_status, deal_value, created_at").eq("company_id", actor.profile.company_id).gte("created_at", fromIso).lte("created_at", toIso).limit(10000),
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
  const maxSource = Math.max(...summary.sourceCounts.map((s) => s.count), 1);
  const maxCity = Math.max(...summary.cityCounts.map((s) => s.count), 1);
  const maxStage = Math.max(...summary.stageCounts.map((s) => s.count), 1);

  const inputCls = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Actionable lead, follow-up, site visit, and conversion insights."
        breadcrumbs={[{ label: "Management" }, { label: "Reports" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/api/reports/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=csv`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              CSV
            </Link>
            <Link
              href={`/api/reports/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=xlsx`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 shadow-sm transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export Excel
            </Link>
          </div>
        }
      />

      {/* Date range filter */}
      <form className="rounded-xl border border-border bg-surface p-4 shadow-card" method="get">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-text-disabled">From</label>
            <input type="date" name="from" defaultValue={from} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-text-disabled">To</label>
            <input type="date" name="to" defaultValue={to} className={inputCls} />
          </div>
          <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm">
            Apply
          </button>
        </div>
      </form>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Total Leads", value: summary.totalLeads, accent: "purple" },
          { label: "Open Leads", value: summary.openLeads, accent: "blue" },
          { label: "Hot Leads", value: summary.hotLeads, accent: "red" },
          { label: "Conversion Rate", value: `${summary.conversionRate}%`, accent: "green" },
          { label: "Won Deals", value: summary.wonDeals, accent: "green" },
          { label: "Deal Value", value: `₹${Number(summary.totalDealValue).toLocaleString("en-IN")}`, accent: "purple" },
          { label: "Overdue Follow-ups", value: summary.overdueFollowUps, accent: "amber" },
          { label: "Follow-up Done %", value: `${summary.followUpCompletionRate}%`, accent: "blue" },
          { label: "Visits Completed", value: summary.siteVisitsCompleted, accent: "green" },
          { label: "Avg Response (hrs)", value: summary.avgResponseHours, accent: "blue" }
        ].map((card) => {
          const accentMap: Record<string, string> = {
            purple: "border-l-primary-500", blue: "border-l-info-600", red: "border-l-danger-600",
            green: "border-l-success-600", amber: "border-l-warning-600"
          };
          return (
            <article key={card.label} className={`rounded-xl border border-border border-l-4 ${accentMap[card.accent]} bg-surface p-4 shadow-card`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-disabled">{card.label}</p>
              <p className="mt-1 text-xl font-bold text-text-primary">{card.value}</p>
            </article>
          );
        })}
      </div>

      {hasNoData ? (
        <div className="rounded-xl border border-border bg-surface shadow-card">
          <EmptyState
            title="No report data yet"
            description="Create leads and activities first. This report will automatically populate with real metrics."
            action={
              <Link href="/leads" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 shadow-sm transition-colors">
                Create Lead
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Source breakdown */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-text-primary">By Source</h3>
              <div className="space-y-2">
                {summary.sourceCounts.map((item) => (
                  <BarRow key={item.key} label={item.key} value={item.count} max={maxSource} />
                ))}
                {summary.sourceCounts.length === 0 && <p className="text-xs text-text-muted py-4 text-center">No source data</p>}
              </div>
            </div>

            {/* City breakdown */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-text-primary">By City</h3>
              <div className="space-y-2">
                {summary.cityCounts.map((item) => (
                  <BarRow key={item.key} label={item.key} value={item.count} max={maxCity} color="bg-info-500" />
                ))}
                {summary.cityCounts.length === 0 && <p className="text-xs text-text-muted py-4 text-center">No city data</p>}
              </div>
            </div>

            {/* Stage funnel */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-text-primary">Stage Funnel</h3>
              <div className="space-y-2">
                {summary.stageCounts.map((item) => (
                  <BarRow key={item.key} label={formatStageLabel(item.key)} value={item.count} max={maxStage} color="bg-success-500" />
                ))}
                {summary.stageCounts.length === 0 && <p className="text-xs text-text-muted py-4 text-center">No stage data</p>}
              </div>
            </div>
          </div>

          {/* Follow-up & visit stats + Aging */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-text-primary">Follow-up & Visit Performance</h3>
              <div className="space-y-2">
                {[
                  { label: "Pending Follow-ups", val: summary.pendingFollowUps, variant: "warning" as const },
                  { label: "Follow-up Completion", val: `${summary.followUpCompletionRate}%`, variant: "success" as const },
                  { label: "Scheduled Visits", val: summary.siteVisitsScheduled, variant: "info" as const },
                  { label: "No-show Visits", val: summary.siteVisitsNoShow, variant: "danger" as const },
                  { label: "Cancelled Visits", val: summary.siteVisitsCancelled, variant: "default" as const }
                ].map(({ label, val, variant }) => (
                  <div key={label} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
                    <span className="text-sm text-text-secondary">{label}</span>
                    <Badge variant={variant}>{val}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold text-text-primary">Lead Aging Buckets</h3>
              <div className="space-y-2">
                {summary.leadAgingBuckets.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
                    <span className="text-sm text-text-secondary">{item.key}</span>
                    <span className="text-sm font-semibold text-text-primary">{item.count}</span>
                  </div>
                ))}
                {summary.leadAgingBuckets.length === 0 && <p className="text-xs text-text-muted py-4 text-center">No aging data</p>}
              </div>
            </div>
          </div>

          {/* Assignee Performance */}
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-text-primary">Assignee Performance</h3>
            </div>
            <div className="table-container scrollbar-thin">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["User", "Leads", "Follow-ups Done", "Visits Done", "Conversions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.assigneePerformance.map((item) => (
                    <tr key={item.userId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">{item.name}</td>
                      <td className="px-4 py-3">{item.leads}</td>
                      <td className="px-4 py-3">{item.followUpsCompleted}</td>
                      <td className="px-4 py-3">{item.visitsCompleted}</td>
                      <td className="px-4 py-3">
                        <Badge variant={item.conversions > 0 ? "success" : "default"}>{item.conversions}</Badge>
                      </td>
                    </tr>
                  ))}
                  {summary.assigneePerformance.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState compact title="No assignee data" description="Assign leads to team members to see performance metrics." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
