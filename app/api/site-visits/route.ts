import { NextResponse } from "next/server";
import type { SiteVisitStatus } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";

const VISIT_STATUSES: SiteVisitStatus[] = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled"
];

export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "site_visits.manage");

    const payload = (await request.json()) as {
      leadId?: string;
      assignedSalesUserId?: string | null;
      visitDate?: string;
      projectName?: string;
      location?: string;
      pickupRequired?: boolean;
      pickupAddress?: string;
      visitStatus?: SiteVisitStatus;
      outcome?: string;
      notes?: string;
      nextAction?: string;
      nextFollowupAt?: string;
    };

    const leadId = payload.leadId?.trim();
    const visitDateInput = payload.visitDate?.trim();
    if (!leadId || !visitDateInput) {
      return NextResponse.json({ error: "Lead and visit date are required" }, { status: 400 });
    }
    const visitDate = new Date(visitDateInput);
    if (Number.isNaN(visitDate.valueOf())) {
      return NextResponse.json({ error: "Invalid visit date" }, { status: 400 });
    }

    const visitStatus = payload.visitStatus ?? "scheduled";
    if (!VISIT_STATUSES.includes(visitStatus)) {
      return NextResponse.json({ error: "Invalid visit status" }, { status: 400 });
    }

    let nextFollowupIso: string | null = null;
    if (payload.nextFollowupAt?.trim()) {
      const parsed = new Date(payload.nextFollowupAt);
      if (Number.isNaN(parsed.valueOf())) {
        return NextResponse.json({ error: "Invalid next follow-up date" }, { status: 400 });
      }
      nextFollowupIso = parsed.toISOString();
    }

    const admin = createAdminSupabaseClient();
    const { data: lead } = await admin
      .from("leads")
      .select("id, company_id, assigned_to, full_name")
      .eq("id", leadId)
      .single();
    if (!lead || lead.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const assignedSalesUserId = payload.assignedSalesUserId ?? lead.assigned_to ?? actor.profile.id;
    const { data: assignee } = await admin
      .from("user_profiles")
      .select("id, company_id, status")
      .eq("id", assignedSalesUserId)
      .single();
    if (!assignee || assignee.company_id !== actor.profile.company_id || assignee.status !== "active") {
      return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
    }

    const { data: siteVisit, error } = await admin
      .from("site_visits")
      .insert({
        company_id: actor.profile.company_id,
        lead_id: leadId,
        assigned_sales_user_id: assignedSalesUserId,
        visit_date: visitDate.toISOString(),
        visit_status: visitStatus,
        project_name: payload.projectName?.trim() || null,
        location: payload.location?.trim() || null,
        pickup_required: Boolean(payload.pickupRequired),
        pickup_address: payload.pickupAddress?.trim() || null,
        outcome: payload.outcome?.trim() || null,
        notes: payload.notes?.trim() || null,
        next_action: payload.nextAction?.trim() || null,
        next_followup_at: nextFollowupIso
      })
      .select("id")
      .single();
    if (error || !siteVisit) {
      return NextResponse.json({ error: error?.message ?? "Failed to create site visit" }, { status: 400 });
    }

    await admin
      .from("leads")
      .update({
        pipeline_stage: visitStatus === "completed" ? "visit_done" : "site_visit_planned",
        next_followup_at: nextFollowupIso,
        site_visit_interest: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", leadId)
      .eq("company_id", actor.profile.company_id);

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "site_visit",
      entityId: siteVisit.id,
      action: "site_visit.created",
      description: `Site visit created for ${lead.full_name}`
    });

    await createNotification(admin, {
      companyId: actor.profile.company_id,
      userProfileId: assignedSalesUserId,
      notificationType: "assignment",
      eventType: "site_visit.scheduled",
      entityType: "site_visit",
      entityId: siteVisit.id,
      actionUrl: "/site-visits",
      title: "Site visit assigned",
      message: `${lead.full_name} site visit scheduled for ${visitDate.toLocaleString()}.`,
      payload: {
        leadId,
        siteVisitId: siteVisit.id
      }
    });

    return NextResponse.json({ success: true, id: siteVisit.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
