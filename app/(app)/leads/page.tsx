import Link from "next/link";
import { LeadsPageClient } from "@/components/leads-page-client";
import type { UserProfile } from "@/lib/db-types";
import { getActorContext, hasPermission, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";

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
      <PageHeader
        title="Leads"
        subtitle="Capture, qualify, and assign leads. Click any lead to view the full detail."
        breadcrumbs={[{ label: "Main" }, { label: "Leads" }]}
        actions={
          canCreate ? (
            <Link
              href="/leads"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 shadow-sm transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Create Lead
            </Link>
          ) : undefined
        }
      />
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
