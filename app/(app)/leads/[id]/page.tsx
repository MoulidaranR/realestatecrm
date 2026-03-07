import { redirect } from "next/navigation";
import { LeadDetailClient } from "@/components/lead-detail-client";
import type { Deal, FollowUp, Lead, LeadNote, SiteVisit, UserProfile } from "@/lib/db-types";
import { getActorContext, hasPermission, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type LeadDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const actor = await getActorContext();
  await requirePermission(actor, "leads.read");
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("company_id", actor.profile.company_id)
    .single();

  if (!lead) {
    redirect("/leads");
  }

  const [{ data: users }, { data: notes }, { data: followUps }, { data: siteVisits }, { data: deals }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, full_name, role_key, status")
      .eq("company_id", actor.profile.company_id)
      .order("full_name", { ascending: true }),
    supabase
      .from("lead_notes")
      .select("*")
      .eq("company_id", actor.profile.company_id)
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("follow_ups")
      .select("*")
      .eq("company_id", actor.profile.company_id)
      .eq("lead_id", id)
      .order("due_at", { ascending: true }),
    supabase
      .from("site_visits")
      .select("*")
      .eq("company_id", actor.profile.company_id)
      .eq("lead_id", id)
      .order("visit_date", { ascending: false }),
    supabase
      .from("deals")
      .select("*")
      .eq("company_id", actor.profile.company_id)
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
  ]);

  const userMap = new Map((users ?? []).map((user) => [user.id, user.full_name]));
  const typedLead = lead as Lead;
  const typedNotes = (notes ?? []) as LeadNote[];
  const typedFollowUps = (followUps ?? []) as FollowUp[];
  const typedSiteVisits = (siteVisits ?? []) as SiteVisit[];
  const typedDeals = (deals ?? []) as Deal[];

  const canAssign = await hasPermission(actor.profile.role_key, "leads.assign");
  const canUpdateLead = await hasPermission(actor.profile.role_key, "leads.update");
  const canManageFollowUps = await hasPermission(actor.profile.role_key, "followups.manage");
  const canManageSiteVisits = await hasPermission(actor.profile.role_key, "site_visits.manage");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Lead detail</h1>
        <p className="text-sm text-slate-500">
          Complete profile, tasks, and visit flow for this lead.
        </p>
      </div>

      <LeadDetailClient
        lead={{
          ...typedLead,
          assignee_name: typedLead.assigned_to ? (userMap.get(typedLead.assigned_to) ?? null) : null,
          creator_name: userMap.get(typedLead.created_by) ?? null
        }}
        users={(users ?? []) as Array<
          Pick<UserProfile, "id" | "full_name" | "role_key" | "status">
        >}
        notes={typedNotes.map((note) => ({
          ...note,
          author_name: userMap.get(note.author_user_id) ?? null
        }))}
        followUps={typedFollowUps.map((followUp) => ({
          ...followUp,
          assignee_name: userMap.get(followUp.assigned_user_id) ?? null
        }))}
        siteVisits={typedSiteVisits.map((visit) => ({
          ...visit,
          assignee_name: userMap.get(visit.assigned_sales_user_id) ?? null
        }))}
        deals={typedDeals.map((deal) => ({
          ...deal,
          sales_user_name: userMap.get(deal.sales_user_id) ?? null
        }))}
        canAssign={canAssign}
        canUpdateLead={canUpdateLead}
        canManageFollowUps={canManageFollowUps}
        canManageSiteVisits={canManageSiteVisits}
      />
    </div>
  );
}
