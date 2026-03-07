import { FollowUpsTable } from "@/components/follow-ups-table";
import type { Lead, UserProfile } from "@/lib/db-types";
import { getActorContext, hasPermission, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function FollowUpsPage() {
  const actor = await getActorContext();
  await requirePermission(actor, "followups.read");

  const supabase = await createServerSupabaseClient();
  const [{ data: followUps }, { data: leads }, { data: users }, canManage] = await Promise.all([
    supabase
      .from("follow_ups")
      .select(
        "id, lead_id, assigned_user_id, due_at, status, mode, purpose, outcome, priority, note, next_followup_at, created_at, completed_at"
      )
      .eq("company_id", actor.profile.company_id)
      .order("due_at", { ascending: true })
      .limit(500),
    supabase
      .from("leads")
      .select("id, full_name, phone, city, source_platform, lead_priority")
      .eq("company_id", actor.profile.company_id)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("user_profiles")
      .select("id, full_name, role_key, status")
      .eq("company_id", actor.profile.company_id)
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    hasPermission(actor.profile.role_key, "followups.manage")
  ]);

  const leadMap = new Map((leads ?? []).map((lead) => [lead.id, lead]));
  const userMap = new Map((users ?? []).map((user) => [user.id, user.full_name]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Follow-ups</h1>
        <p className="text-sm text-slate-500">
          Create and manage follow-up cycles with outcomes, priorities, and one-click rescheduling.
        </p>
      </div>
      <FollowUpsTable
        initialFollowUps={(followUps ?? []).map((item) => {
          const lead = leadMap.get(item.lead_id) as Lead | undefined;
          return {
            ...item,
            lead_name: lead?.full_name ?? "Unknown lead",
            lead_phone: lead?.phone ?? "-",
            lead_city: lead?.city ?? "Unknown",
            lead_source_platform: lead?.source_platform ?? "unknown",
            lead_priority: lead?.lead_priority ?? "warm",
            assignee_name: userMap.get(item.assigned_user_id) ?? "Unknown user"
          };
        })}
        leads={(leads ?? []).map((lead) => ({
          id: lead.id,
          full_name: lead.full_name,
          phone: lead.phone,
          city: lead.city,
          source_platform: lead.source_platform,
          lead_priority: lead.lead_priority
        }))}
        users={(users ?? []) as Array<
          Pick<UserProfile, "id" | "full_name" | "role_key" | "status">
        >}
        canManage={canManage}
      />
    </div>
  );
}
