import { NextResponse } from "next/server";
import type { FollowUpStatus } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { refreshLeadAutomation } from "@/lib/lead-automation";

const FOLLOW_UP_STATUSES: FollowUpStatus[] = ["pending", "completed", "cancelled"];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "followups.manage");
    const { id } = await context.params;

    const payload = (await request.json()) as { status?: FollowUpStatus };
    const status = payload.status;
    if (!status || !FOLLOW_UP_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: followUp, error: followUpError } = await admin
      .from("follow_ups")
      .select("id, company_id, lead_id")
      .eq("id", id)
      .single();
    if (followUpError || !followUp) {
      return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });
    }
    if (followUp.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: updateError } = await admin
      .from("follow_ups")
      .update({ status })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    if (status === "completed") {
      await admin
        .from("leads")
        .update({
          last_contacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", followUp.lead_id)
        .eq("company_id", actor.profile.company_id);
    }

    await refreshLeadAutomation(admin, followUp.lead_id, actor.profile.company_id);

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "follow_up",
      entityId: id,
      action: "followup.status_changed",
      description: `Follow-up status changed to ${status}`,
      metadata: {
        leadId: followUp.lead_id,
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
