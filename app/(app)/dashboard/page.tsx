import Link from "next/link";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatStageLabel } from "@/lib/lead-options";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "-";
  }
  return date.toLocaleString();
}

export default async function DashboardPage() {
  const actor = await getActorContext();
  await requirePermission(actor, "dashboard.view");

  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const nextSevenDays = new Date(todayStart);
  nextSevenDays.setDate(nextSevenDays.getDate() + 7);

  const [
    { count: totalLeads },
    { count: newLeadsToday },
    { count: openLeads },
    { count: hotLeads },
    { count: dueToday },
    { count: overdueFollowUps },
    { count: upcomingFollowUps },
    { count: completedToday },
    { count: scheduledSiteVisitsToday },
    { count: completedSiteVisits },
    { count: noShowSiteVisits },
    { count: activeUsers },
    { count: wonLeads },
    { data: leadRows },
    { data: activityLogs }
  ] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("company_id", actor.profile.company_id),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .gte("created_at", todayStart.toISOString())
      .lt("created_at", tomorrowStart.toISOString()),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .eq("lead_status", "open"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .eq("lead_priority", "hot"),
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .eq("status", "pending")
      .gte("due_at", todayStart.toISOString())
      .lt("due_at", tomorrowStart.toISOString()),
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .eq("status", "pending")
      .lt("due_at", now.toISOString()),
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .eq("status", "pending")
      .gt("due_at", tomorrowStart.toISOString())
      .lte("due_at", nextSevenDays.toISOString()),
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .eq("status", "completed")
      .gte("completed_at", todayStart.toISOString())
      .lt("completed_at", tomorrowStart.toISOString()),
    supabase
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .in("visit_status", ["scheduled", "rescheduled"])
      .gte("visit_date", todayStart.toISOString())
      .lt("visit_date", tomorrowStart.toISOString()),
    supabase
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .eq("visit_status", "completed"),
    supabase
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .in("visit_status", ["no_show", "cancelled"]),
    supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .eq("status", "active"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .or("lead_status.eq.won,pipeline_stage.eq.booked"),
    supabase
      .from("leads")
      .select("pipeline_stage, lead_status, source_platform")
      .eq("company_id", actor.profile.company_id)
      .limit(2000),
    supabase
      .from("activity_logs")
      .select("id, actor_user_id, action, entity_type, entity_id, description, created_at")
      .eq("company_id", actor.profile.company_id)
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  const actorIds = Array.from(
    new Set((activityLogs ?? []).map((log) => log.actor_user_id).filter(Boolean))
  );
  const { data: actors } = actorIds.length
    ? await supabase.from("user_profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as Array<{ id: string; full_name: string }> };
  const actorMap = new Map((actors ?? []).map((item) => [item.id, item.full_name]));

  const pipelineMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  for (const lead of leadRows ?? []) {
    pipelineMap.set(lead.pipeline_stage, (pipelineMap.get(lead.pipeline_stage) ?? 0) + 1);
    statusMap.set(lead.lead_status, (statusMap.get(lead.lead_status) ?? 0) + 1);
    sourceMap.set(lead.source_platform || "unknown", (sourceMap.get(lead.source_platform || "unknown") ?? 0) + 1);
  }

  const conversionRate =
    (totalLeads ?? 0) > 0 ? Number((((wonLeads ?? 0) / (totalLeads ?? 1)) * 100).toFixed(2)) : 0;
  const hasNoData = (totalLeads ?? 0) === 0 && (dueToday ?? 0) === 0 && (scheduledSiteVisitsToday ?? 0) === 0;

  const cards = [
    { label: "Total Leads", value: totalLeads ?? 0 },
    { label: "New Leads Today", value: newLeadsToday ?? 0 },
    { label: "Open Leads", value: openLeads ?? 0 },
    { label: "Hot Leads", value: hotLeads ?? 0 },
    { label: "Follow-ups Due Today", value: dueToday ?? 0 },
    { label: "Overdue Follow-ups", value: overdueFollowUps ?? 0 },
    { label: "Scheduled Visits Today", value: scheduledSiteVisitsToday ?? 0 },
    { label: "Completed Site Visits", value: completedSiteVisits ?? 0 },
    { label: "Conversion Rate", value: `${conversionRate}%` },
    { label: "Active Users", value: activeUsers ?? 0 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Real-time operations across leads, follow-ups, visits, and team productivity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/leads" className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">
            Create Lead
          </Link>
          <Link href="/follow-ups" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
            Schedule Follow-up
          </Link>
          <Link href="/site-visits" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
            Schedule Site Visit
          </Link>
          <Link href="/reports" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
            Export Report
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
          </article>
        ))}
      </section>

      {hasNoData ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <h2 className="text-lg font-bold text-slate-900">Welcome to your CRM workspace</h2>
          <p className="mt-1 text-sm text-slate-500">
            Start by creating your first lead. Metrics, follow-up health, and conversion insights will appear automatically.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/leads" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
              Create Your First Lead
            </Link>
            <Link href="/users" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Invite Team
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Lead Pipeline Summary</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from(pipelineMap.entries()).map(([stage, count]) => (
              <div key={stage} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase text-slate-500">{formatStageLabel(stage)}</p>
                <p className="text-lg font-bold text-slate-900">{count}</p>
              </div>
            ))}
            {pipelineMap.size === 0 ? (
              <p className="text-sm text-slate-500">No pipeline data yet.</p>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from(statusMap.entries()).map(([status, count]) => (
              <span key={status} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {status}: {count}
              </span>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Follow-up Summary</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">Due Today</p>
              <p className="text-xl font-bold text-slate-900">{dueToday ?? 0}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">Overdue</p>
              <p className="text-xl font-bold text-rose-600">{overdueFollowUps ?? 0}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">Upcoming 7 Days</p>
              <p className="text-xl font-bold text-slate-900">{upcomingFollowUps ?? 0}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">Completed Today</p>
              <p className="text-xl font-bold text-emerald-600">{completedToday ?? 0}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Site Visit Summary</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">Scheduled Today</p>
              <p className="text-xl font-bold text-slate-900">{scheduledSiteVisitsToday ?? 0}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">Completed</p>
              <p className="text-xl font-bold text-emerald-600">{completedSiteVisits ?? 0}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">No-show/Cancelled</p>
              <p className="text-xl font-bold text-rose-600">{noShowSiteVisits ?? 0}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-slate-500">Upcoming Sources</p>
              <p className="text-xl font-bold text-slate-900">{sourceMap.size}</p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Recent Activity</h3>
          <ul className="mt-3 space-y-2">
            {(activityLogs ?? []).map((log) => (
              <li key={log.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <p className="font-semibold text-slate-800">{log.action}</p>
                <p className="text-slate-600">{log.description}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {actorMap.get(log.actor_user_id ?? "") ?? "System"} | {formatDateTime(log.created_at)}
                </p>
              </li>
            ))}
            {(activityLogs ?? []).length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Activity will appear as your team works with leads and follow-ups.
              </li>
            ) : null}
          </ul>
        </article>
      </section>
    </div>
  );
}
