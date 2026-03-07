import { FollowUpsTable } from "@/components/follow-ups-table";
import type { FollowUp, Lead, UserProfile } from "@/lib/db-types";
import { getActorContext, hasPermission, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function FollowUpsPage() {
  const actor = await getActorContext();
  await requirePermission(actor, "followups.read");

  const supabase = await createServerSupabaseClient();
  const { data: followUps } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("company_id", actor.profile.company_id)
    .order("due_at", { ascending: true })
    .limit(300);

  const leadIds = Array.from(new Set((followUps ?? []).map((item) => item.lead_id)));
  const userIds = Array.from(new Set((followUps ?? []).map((item) => item.assigned_user_id)));

  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id, full_name").in("id", leadIds)
    : { data: [] as Array<Pick<Lead, "id" | "full_name">> };
  const { data: users } = userIds.length
    ? await supabase.from("user_profiles").select("id, full_name").in("id", userIds)
    : { data: [] as Array<Pick<UserProfile, "id" | "full_name">> };

  const leadMap = new Map((leads ?? []).map((lead) => [lead.id, lead.full_name]));
  const userMap = new Map((users ?? []).map((user) => [user.id, user.full_name]));
  const canManage = await hasPermission(actor.profile.role_key, "followups.manage");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Follow-ups</h1>
        <p className="text-sm text-slate-500">
          Task-first view for today, overdue, and upcoming follow-ups.
        </p>
      </div>
      <FollowUpsTable
        initialFollowUps={((followUps ?? []) as FollowUp[]).map((item) => ({
          ...item,
          lead_name: leadMap.get(item.lead_id) ?? "Unknown lead",
          assignee_name: userMap.get(item.assigned_user_id) ?? "Unknown user"
        }))}
        canManage={canManage}
      />
    </div>
  );
}
