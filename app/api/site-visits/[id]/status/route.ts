import { NextResponse } from "next/server";
import type { SiteVisitStatus } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";

const SITE_VISIT_STATUSES: SiteVisitStatus[] = [
  "scheduled",
  "completed",
  "no_show",
  "rescheduled",
  "cancelled"
];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function nextPipelineStage(status: SiteVisitStatus): string {
  if (status === "completed") {
    return "visit_done";
  }
  if (status === "rescheduled" || status === "scheduled") {
    return "site_visit_planned";
  }
  return "follow_up_due";
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "site_visits.manage");
    const { id } = await context.params;

    const payload = (await request.json()) as {
      status?: SiteVisitStatus;
      outcome?: string | null;
      notes?: string | null;
      nextAction?: string | null;
      nextFollowupAt?: string | null;
    };
    const status = payload.status;
    if (!status || !SITE_VISIT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
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
    const { data: siteVisit, error: siteVisitError } = await admin
      .from("site_visits")
      .select("id, company_id, lead_id, assigned_sales_user_id, visit_status")
      .eq("id", id)
      .single();
    if (siteVisitError || !siteVisit) {
      return NextResponse.json({ error: "Site visit not found" }, { status: 404 });
    }
    if (siteVisit.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: updateError } = await admin
      .from("site_visits")
      .update({
        visit_status: status,
        outcome: payload.outcome?.trim() || null,
        notes: payload.notes?.trim() || null,
        next_action: payload.nextAction?.trim() || null,
        next_followup_at: nextFollowupIso
      })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await admin
      .from("leads")
      .update({
        pipeline_stage: nextPipelineStage(status),
        next_followup_at: nextFollowupIso,
        site_visit_interest: status === "completed",
        updated_at: new Date().toISOString()
      })
      .eq("id", siteVisit.lead_id)
      .eq("company_id", actor.profile.company_id);

    let createdNextFollowUpId: string | null = null;
    if (nextFollowupIso) {
      const { data: followUp } = await admin
        .from("follow_ups")
        .insert({
          company_id: actor.profile.company_id,
          lead_id: siteVisit.lead_id,
          assigned_user_id: siteVisit.assigned_sales_user_id,
          due_at: nextFollowupIso,
          status: "pending",
          mode: "call",
          priority: "medium",
          purpose: "Post site-visit follow-up",
          note: "Created from site-visit status update"
        })
        .select("id")
        .single();
      createdNextFollowUpId = followUp?.id ?? null;
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "site_visit",
      entityId: id,
      action: "site_visit.status_changed",
      description: `Site visit marked ${status}`,
      before: {
        status: siteVisit.visit_status
      },
      after: {
        status,
        createdNextFollowUpId
      }
    });

    await createNotification(admin, {
      companyId: actor.profile.company_id,
      userProfileId: siteVisit.assigned_sales_user_id,
      notificationType: "status_change",
      eventType: "site_visit.updated",
      entityType: "site_visit",
      entityId: id,
      actionUrl: "/site-visits",
      title: "Site visit status updated",
      message: `Site visit status changed to ${status}.`,
      payload: {
        siteVisitId: id,
        createdNextFollowUpId
      }
    });

    return NextResponse.json({ success: true, createdNextFollowUpId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
