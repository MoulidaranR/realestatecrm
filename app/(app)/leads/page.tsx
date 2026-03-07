import { LeadsPageClient } from "@/components/leads-page-client";
import type { Lead, UserProfile } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LeadsPage() {
  const actor = await getActorContext();
  await requirePermission(actor, "leads.read");

  const supabase = await createServerSupabaseClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .eq("company_id", actor.profile.company_id)
    .order("created_at", { ascending: false })
    .limit(200);

  const assigneeIds = Array.from(new Set((leads ?? []).map((lead) => lead.assigned_to).filter(Boolean)));
  const { data: assignees } = assigneeIds.length
    ? await supabase.from("user_profiles").select("id, full_name").in("id", assigneeIds)
    : { data: [] as Array<Pick<UserProfile, "id" | "full_name">> };
  const assigneeMap = new Map((assignees ?? []).map((profile) => [profile.id, profile.full_name]));

  const enrichedLeads = ((leads ?? []) as Lead[]).map((lead) => ({
    ...lead,
    assignee_name: lead.assigned_to ? (assigneeMap.get(lead.assigned_to) ?? null) : null
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500">
          Phase 2 lead intake and pipeline tracking with assignment visibility.
        </p>
      </div>
      <LeadsPageClient leads={enrichedLeads} />
    </div>
  );
}
