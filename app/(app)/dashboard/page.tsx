import { ChartCard } from "@/components/chart-card";
import { MetricCards } from "@/components/metric-cards";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const actor = await getActorContext();
  await requirePermission(actor, "dashboard.view");

  const supabase = await createServerSupabaseClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const [{ count: totalLeads }, { count: newLeadsToday }, { count: pendingFollowUps }, { count: visitsToday }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("company_id", actor.profile.company_id),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("company_id", actor.profile.company_id)
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", tomorrowStart.toISOString()),
      supabase
        .from("follow_ups")
        .select("id", { count: "exact", head: true })
        .eq("company_id", actor.profile.company_id)
        .eq("status", "pending"),
      supabase
        .from("site_visits")
        .select("id", { count: "exact", head: true })
        .eq("company_id", actor.profile.company_id)
        .gte("visit_date", todayStart.toISOString())
        .lt("visit_date", tomorrowStart.toISOString())
    ]);

  const cards = [
    { label: "Total Leads", value: totalLeads ?? 0 },
    { label: "New Leads Today", value: newLeadsToday ?? 0 },
    { label: "Pending Follow-ups", value: pendingFollowUps ?? 0 },
    { label: "Visits Today", value: visitsToday ?? 0 }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Operational overview across leads, follow-ups, and site visits.
        </p>
      </div>
      <MetricCards cards={cards} />
      <ChartCard />
    </div>
  );
}
