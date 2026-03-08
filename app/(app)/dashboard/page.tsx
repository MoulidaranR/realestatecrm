import Link from "next/link";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatStageLabel } from "@/lib/lead-options";
import { PageHeader } from "@/components/ui/page-header";

function fmt(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? "-" : d.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
}

function StatCard({
  label,
  value,
  sub,
  accent,
  icon
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "purple" | "green" | "amber" | "red" | "blue";
  icon: React.ReactNode;
}) {
  const accentMap = {
    purple: "bg-primary-50 text-primary-600",
    green: "bg-success-50 text-success-600",
    amber: "bg-warning-50 text-warning-600",
    red: "bg-danger-50 text-danger-600",
    blue: "bg-info-50 text-info-600"
  };
  const cls = accentMap[accent ?? "purple"];
  return (
    <article className="rounded-xl border border-border bg-surface p-4 shadow-card flex items-start gap-3">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${cls}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted truncate">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-text-primary leading-none">{value}</p>
        {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
      </div>
    </article>
  );
}

const I = ({ d }: { d: string }) => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

export default async function DashboardPage() {
  const actor = await getActorContext();
  await requirePermission(actor, "dashboard.view");

  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const nextSevenDays = new Date(todayStart); nextSevenDays.setDate(nextSevenDays.getDate() + 7);

  const [
    { count: totalLeads },
    { count: newLeadsToday },
    { count: openLeads },
    { count: hotLeads },
    { count: dueToday },
    { count: overdueFollowUps },
    { count: upcomingFollowUps },
    { count: completedToday },
    { count: scheduledVisitsToday },
    { count: completedVisits },
    { count: noShowVisits },
    { count: activeUsers },
    { count: wonLeads },
    { data: leadRows },
    { data: activityLogs }
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).gte("created_at", todayStart.toISOString()).lt("created_at", tomorrowStart.toISOString()),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).eq("lead_status", "open"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).eq("lead_priority", "hot"),
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).eq("status", "pending").gte("due_at", todayStart.toISOString()).lt("due_at", tomorrowStart.toISOString()),
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).eq("status", "pending").lt("due_at", now.toISOString()),
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).eq("status", "pending").gt("due_at", tomorrowStart.toISOString()).lte("due_at", nextSevenDays.toISOString()),
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).eq("status", "completed").gte("completed_at", todayStart.toISOString()).lt("completed_at", tomorrowStart.toISOString()),
    supabase.from("site_visits").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).in("visit_status", ["scheduled", "rescheduled"]).gte("visit_date", todayStart.toISOString()).lt("visit_date", tomorrowStart.toISOString()),
    supabase.from("site_visits").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).eq("visit_status", "completed"),
    supabase.from("site_visits").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).in("visit_status", ["no_show", "cancelled"]),
    supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).eq("status", "active"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id).or("lead_status.eq.won,pipeline_stage.eq.booked"),
    supabase.from("leads").select("pipeline_stage, lead_status, source_platform").eq("company_id", actor.profile.company_id).limit(2000),
    supabase.from("activity_logs").select("id, actor_user_id, action, entity_type, description, created_at").eq("company_id", actor.profile.company_id).order("created_at", { ascending: false }).limit(10)
  ]);

  const actorIds = Array.from(new Set((activityLogs ?? []).map((l) => l.actor_user_id).filter(Boolean)));
  const { data: actors } = actorIds.length
    ? await supabase.from("user_profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as Array<{ id: string; full_name: string }> };
  const actorMap = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  const pipelineMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  for (const lead of leadRows ?? []) {
    pipelineMap.set(lead.pipeline_stage, (pipelineMap.get(lead.pipeline_stage) ?? 0) + 1);
    const src = lead.source_platform || "other";
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
  }

  const conversionRate = (totalLeads ?? 0) > 0
    ? Number((((wonLeads ?? 0) / (totalLeads ?? 1)) * 100).toFixed(1))
    : 0;
  const hasNoData = (totalLeads ?? 0) === 0;

  const PIPELINE_ORDER = ["new","attempted","contacted","interested","follow_up_due","site_visit_planned","visit_done","negotiation","booked","lost"];
  const sortedPipeline = PIPELINE_ORDER
    .map((stage) => ({ stage, count: pipelineMap.get(stage) ?? 0 }))
    .filter((s) => s.count > 0);
  const maxPipelineCount = Math.max(...sortedPipeline.map((s) => s.count), 1);

  const topSources = Array.from(sourceMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const maxSourceCount = Math.max(...topSources.map(([, c]) => c), 1);

  function getActionIcon(action: string) {
    if (action.includes("lead")) return "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0";
    if (action.includes("visit")) return "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z";
    if (action.includes("follow")) return "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z";
    return "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Real-time operations — leads, follow-ups, visits, and team activity."
        actions={
          <>
            <Link href="/leads" className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Create Lead
            </Link>
            <Link href="/reports" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Reports
            </Link>
          </>
        }
      />

      {/* Empty state for brand new company */}
      {hasNoData && (
        <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/40 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
            <svg className="h-7 w-7 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-text-primary">Your CRM is ready</h2>
          <p className="mt-1 text-sm text-text-muted max-w-xs mx-auto">
            Start by adding your first lead. Metrics and insights will appear automatically as your team works.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/leads" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm">
              Add First Lead
            </Link>
            <Link href="/users" className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              Invite Team
            </Link>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Leads" value={totalLeads ?? 0} sub={`${openLeads ?? 0} open`} accent="purple"
          icon={<I d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />}
        />
        <StatCard label="New Today" value={newLeadsToday ?? 0} sub="leads captured" accent="blue"
          icon={<I d="M12 4v16m8-8H4" />}
        />
        <StatCard label="Hot Leads" value={hotLeads ?? 0} sub="high priority" accent="red"
          icon={<I d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />}
        />
        <StatCard label="Follow-ups Due" value={dueToday ?? 0} sub={`${overdueFollowUps ?? 0} overdue`} accent="amber"
          icon={<I d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />}
        />
        <StatCard label="Conversion" value={`${conversionRate}%`} sub={`${wonLeads ?? 0} won`} accent="green"
          icon={<I d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
        />
      </div>

      {/* Second row: Follow-up health + Site visits */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Follow-up health */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Follow-up Health</h3>
            <Link href="/follow-ups" className="text-xs font-medium text-primary-600 hover:underline">View all →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Due Today", val: dueToday ?? 0, color: "text-warning-600 bg-warning-50" },
              { label: "Overdue", val: overdueFollowUps ?? 0, color: "text-danger-600 bg-danger-50" },
              { label: "Next 7 Days", val: upcomingFollowUps ?? 0, color: "text-info-600 bg-info-50" },
              { label: "Done Today", val: completedToday ?? 0, color: "text-success-600 bg-success-50" }
            ].map(({ label, val, color }) => (
              <div key={label} className={`rounded-lg p-3 ${color.split(" ")[1]}`}>
                <p className="text-xs text-slate-600">{label}</p>
                <p className={`mt-1 text-2xl font-bold ${color.split(" ")[0]}`}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Site visits */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Site Visits</h3>
            <Link href="/site-visits" className="text-xs font-medium text-primary-600 hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {[
              { label: "Today", val: scheduledVisitsToday ?? 0, dot: "bg-info-600" },
              { label: "Completed", val: completedVisits ?? 0, dot: "bg-success-600" },
              { label: "No-show / Cancelled", val: noShowVisits ?? 0, dot: "bg-danger-600" },
              { label: "Active Team", val: activeUsers ?? 0, dot: "bg-primary-600" }
            ].map(({ label, val, dot }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className="text-xs text-text-secondary">{label}</span>
                </div>
                <span className="text-sm font-semibold text-text-primary">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline funnel + Lead sources */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pipeline funnel */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Pipeline Funnel</h3>
              <p className="text-xs text-text-muted">{totalLeads ?? 0} total leads</p>
            </div>
            <Link href="/leads" className="text-xs font-medium text-primary-600 hover:underline">View leads →</Link>
          </div>
          {sortedPipeline.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">No leads yet</p>
          ) : (
            <div className="space-y-2">
              {sortedPipeline.map(({ stage, count }) => {
                const pct = Math.round((count / maxPipelineCount) * 100);
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <p className="w-32 flex-shrink-0 truncate text-xs text-text-secondary">{formatStageLabel(stage)}</p>
                    <div className="flex-1 rounded-full bg-slate-100 h-2">
                      <div
                        className="h-2 rounded-full bg-primary-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 flex-shrink-0 text-right text-xs font-semibold text-text-primary">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lead sources */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Lead Sources</h3>
              <p className="text-xs text-text-muted">Where leads are coming from</p>
            </div>
          </div>
          {topSources.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">No source data yet</p>
          ) : (
            <div className="space-y-2">
              {topSources.map(([src, count]) => {
                const pct = Math.round((count / maxSourceCount) * 100);
                return (
                  <div key={src} className="flex items-center gap-3">
                    <p className="w-28 flex-shrink-0 truncate text-xs capitalize text-text-secondary">
                      {src.replace(/_/g, " ")}
                    </p>
                    <div className="flex-1 rounded-full bg-slate-100 h-2">
                      <div
                        className="h-2 rounded-full bg-info-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 flex-shrink-0 text-right text-xs font-semibold text-text-primary">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Recent Activity</h3>
          <Link href="/activity-logs" className="text-xs font-medium text-primary-600 hover:underline">View all →</Link>
        </div>
        {(activityLogs ?? []).length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-text-muted">Activity will appear as your team works with leads.</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-slate-100">
            {(activityLogs ?? []).map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2.5">
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={getActionIcon(log.action)} />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-primary">
                    <span className="font-medium">{actorMap.get(log.actor_user_id ?? "") ?? "System"}</span>
                    {" · "}
                    {log.description}
                  </p>
                  <p className="mt-0.5 text-[10px] text-text-muted">{fmt(log.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
