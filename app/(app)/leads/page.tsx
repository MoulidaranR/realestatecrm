import { LeadsPageClient } from "@/components/leads-page-client";
import type { UserProfile } from "@/lib/db-types";
import { getActorContext, hasPermission, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LeadsPage() {
  const actor = await getActorContext();
  await requirePermission(actor, "leads.read");

  const supabase = await createServerSupabaseClient();
  const [{ data: leads }, { data: users }] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, full_name, phone, email, city, source_platform, lead_priority, pipeline_stage, lead_status, score, assigned_to, next_followup_at, created_at"
      )
      .eq("company_id", actor.profile.company_id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("user_profiles")
      .select("id, full_name, role_key, status")
      .eq("company_id", actor.profile.company_id)
      .eq("status", "active")
      .order("full_name", { ascending: true })
  ]);

  const userMap = new Map((users ?? []).map((profile) => [profile.id, profile.full_name]));
  const canCreate = await hasPermission(actor.profile.role_key, "leads.create");
  const canAssign = await hasPermission(actor.profile.role_key, "leads.assign");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500">
          Capture, qualify, and assign leads with real estate specific requirements.
        </p>
      </div>
      <LeadsPageClient
        leads={(leads ?? []).map((lead) => ({
          ...lead,
          assignee_name: lead.assigned_to ? (userMap.get(lead.assigned_to) ?? null) : null
        }))}
        users={(users ?? []) as Array<
          Pick<UserProfile, "id" | "full_name" | "role_key" | "status">
        >}
        canCreate={canCreate}
        canAssign={canAssign}
      />
    </div>
  );
}
