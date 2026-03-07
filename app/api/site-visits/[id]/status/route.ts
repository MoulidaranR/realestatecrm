import { NextResponse } from "next/server";
import type { SiteVisitStatus } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { refreshLeadAutomation } from "@/lib/lead-automation";

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

    const payload = (await request.json()) as { status?: SiteVisitStatus };
    const status = payload.status;
    if (!status || !SITE_VISIT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: siteVisit, error: siteVisitError } = await admin
      .from("site_visits")
      .select("id, company_id, lead_id")
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
      .update({ visit_status: status })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await admin
      .from("leads")
      .update({
        pipeline_stage: nextPipelineStage(status),
        updated_at: new Date().toISOString()
      })
      .eq("id", siteVisit.lead_id)
      .eq("company_id", actor.profile.company_id);

    await refreshLeadAutomation(admin, siteVisit.lead_id, actor.profile.company_id);

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "site_visit",
      entityId: id,
      action: "site_visit.status_changed",
      description: `Site visit status changed to ${status}`,
      metadata: {
        leadId: siteVisit.lead_id,
        status
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
