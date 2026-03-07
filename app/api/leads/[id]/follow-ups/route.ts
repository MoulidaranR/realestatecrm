import { NextResponse } from "next/server";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import { refreshLeadAutomation } from "@/lib/lead-automation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "followups.manage");
    const { id } = await context.params;

    const payload = (await request.json()) as {
      dueAt?: string;
      note?: string;
      assignedUserId?: string | null;
    };

    const dueAt = payload.dueAt?.trim();
    const note = payload.note?.trim() || null;
    if (!dueAt) {
      return NextResponse.json({ error: "Due date is required" }, { status: 400 });
    }
    const dueDate = new Date(dueAt);
    if (Number.isNaN(dueDate.valueOf())) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: lead, error: leadError } = await admin
      .from("leads")
      .select("id, company_id, assigned_to")
      .eq("id", id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (lead.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const assignedUserId = payload.assignedUserId ?? lead.assigned_to ?? actor.profile.id;
    const { data: assignee, error: assigneeError } = await admin
      .from("user_profiles")
      .select("id, company_id, status")
      .eq("id", assignedUserId)
      .single();
    if (assigneeError || !assignee) {
      return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
    }
    if (assignee.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (assignee.status !== "active") {
      return NextResponse.json({ error: "Assignee must be active" }, { status: 400 });
    }

    const { error: followUpError } = await admin.from("follow_ups").insert({
      company_id: actor.profile.company_id,
      lead_id: id,
      assigned_user_id: assignedUserId,
      due_at: dueDate.toISOString(),
      status: "pending",
      note
    });
    if (followUpError) {
      return NextResponse.json({ error: followUpError.message }, { status: 400 });
    }

    const { error: updateError } = await admin
      .from("leads")
      .update({
        next_followup_at: dueDate.toISOString(),
        pipeline_stage: "follow_up_due",
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await refreshLeadAutomation(admin, id, actor.profile.company_id);

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "follow_up",
      entityId: null,
      action: "followup.created",
      description: "Follow-up task created",
      metadata: {
        leadId: id,
        assignedUserId,
        dueAt: dueDate.toISOString()
      }
    });

    await createNotification(admin, {
      companyId: actor.profile.company_id,
      userProfileId: assignedUserId,
      eventType: "followup.created",
      title: "New follow-up task",
      message: `A follow-up was scheduled for ${dueDate.toLocaleString()}.`,
      payload: {
        leadId: id
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
