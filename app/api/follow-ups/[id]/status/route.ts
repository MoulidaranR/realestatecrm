import { NextResponse } from "next/server";
import type { FollowUpMode, FollowUpPriority, FollowUpStatus } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";

const FOLLOW_UP_STATUSES: FollowUpStatus[] = ["pending", "completed", "missed", "cancelled"];
const FOLLOW_UP_MODES: FollowUpMode[] = ["call", "whatsapp", "sms", "email", "meeting"];
const FOLLOW_UP_PRIORITIES: FollowUpPriority[] = ["high", "medium", "low"];

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

    const payload = (await request.json()) as {
      status?: FollowUpStatus;
      outcome?: string | null;
      note?: string | null;
      nextFollowupAt?: string | null;
      mode?: FollowUpMode;
      priority?: FollowUpPriority;
      assignedUserId?: string | null;
      purpose?: string | null;
    };
    const status = payload.status;
    if (!status || !FOLLOW_UP_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (payload.mode && !FOLLOW_UP_MODES.includes(payload.mode)) {
      return NextResponse.json({ error: "Invalid follow-up mode" }, { status: 400 });
    }
    if (payload.priority && !FOLLOW_UP_PRIORITIES.includes(payload.priority)) {
      return NextResponse.json({ error: "Invalid follow-up priority" }, { status: 400 });
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
    const { data: followUp, error: followUpError } = await admin
      .from("follow_ups")
      .select("id, company_id, lead_id, assigned_user_id, status, due_at, mode, priority")
      .eq("id", id)
      .single();
    if (followUpError || !followUp) {
      return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });
    }
    if (followUp.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const assignedUserId = payload.assignedUserId ?? followUp.assigned_user_id;
    if (assignedUserId !== followUp.assigned_user_id) {
      const { data: assignee } = await admin
        .from("user_profiles")
        .select("id, company_id, status")
        .eq("id", assignedUserId)
        .single();
      if (!assignee || assignee.company_id !== actor.profile.company_id || assignee.status !== "active") {
        return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
      }
    }

    const { error: updateError } = await admin
      .from("follow_ups")
      .update({
        status,
        outcome: payload.outcome?.trim() || null,
        note: payload.note?.trim() || null,
        next_followup_at: nextFollowupIso,
        assigned_user_id: assignedUserId,
        mode: payload.mode ?? followUp.mode,
        priority: payload.priority ?? followUp.priority,
        purpose: payload.purpose?.trim() || null,
        completed_at: status === "completed" ? new Date().toISOString() : null
      })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    if (status === "completed" || status === "missed") {
      await admin
        .from("leads")
        .update({
          last_contacted_at: new Date().toISOString(),
          next_followup_at: nextFollowupIso,
          updated_at: new Date().toISOString()
        })
        .eq("id", followUp.lead_id)
        .eq("company_id", actor.profile.company_id);
    }

    let createdNextFollowUpId: string | null = null;
    if (nextFollowupIso && (status === "completed" || status === "missed")) {
      const { data: nextFollowUp } = await admin
        .from("follow_ups")
        .insert({
          company_id: actor.profile.company_id,
          lead_id: followUp.lead_id,
          assigned_user_id: assignedUserId,
          due_at: nextFollowupIso,
          status: "pending",
          mode: payload.mode ?? followUp.mode,
          priority: payload.priority ?? followUp.priority,
          purpose: "Next follow-up",
          note: "Created from follow-up completion flow"
        })
        .select("id")
        .single();
      createdNextFollowUpId = nextFollowUp?.id ?? null;
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "follow_up",
      entityId: id,
      action: "followup.status_changed",
      description: `Follow-up marked ${status}`,
      before: {
        status: followUp.status,
        assignedUserId: followUp.assigned_user_id
      },
      after: {
        status,
        assignedUserId,
        createdNextFollowUpId
      }
    });

    if (assignedUserId !== followUp.assigned_user_id || createdNextFollowUpId) {
      await createNotification(admin, {
        companyId: actor.profile.company_id,
        userProfileId: assignedUserId,
        notificationType: assignedUserId !== followUp.assigned_user_id ? "assignment" : "status_change",
        eventType: "followup.updated",
        entityType: "follow_up",
        entityId: id,
        actionUrl: "/follow-ups",
        title: createdNextFollowUpId ? "Next follow-up scheduled" : "Follow-up updated",
        message: createdNextFollowUpId
          ? "A new follow-up has been scheduled from the latest outcome."
          : `Follow-up status changed to ${status}.`,
        payload: {
          followUpId: id,
          createdNextFollowUpId
        }
      });
    }

    return NextResponse.json({ success: true, createdNextFollowUpId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
