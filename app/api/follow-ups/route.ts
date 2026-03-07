import { NextResponse } from "next/server";
import type { FollowUpMode, FollowUpPriority, FollowUpStatus } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";

const MODES: FollowUpMode[] = ["call", "whatsapp", "sms", "email", "meeting"];
const PRIORITIES: FollowUpPriority[] = ["high", "medium", "low"];
const STATUSES: FollowUpStatus[] = ["pending", "completed", "missed", "cancelled"];

export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "followups.manage");

    const payload = (await request.json()) as {
      leadId?: string;
      assignedUserId?: string | null;
      dueAt?: string;
      mode?: FollowUpMode;
      purpose?: string;
      outcome?: string;
      priority?: FollowUpPriority;
      status?: FollowUpStatus;
      note?: string;
      nextFollowupAt?: string;
    };

    const leadId = payload.leadId?.trim();
    const dueAt = payload.dueAt?.trim();
    if (!leadId || !dueAt) {
      return NextResponse.json({ error: "Lead and due date are required" }, { status: 400 });
    }

    const dueDate = new Date(dueAt);
    if (Number.isNaN(dueDate.valueOf())) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }

    const mode = payload.mode ?? "call";
    const priority = payload.priority ?? "medium";
    const status = payload.status ?? "pending";
    if (!MODES.includes(mode) || !PRIORITIES.includes(priority) || !STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid follow-up options" }, { status: 400 });
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

    const assignedUserId = payload.assignedUserId ?? lead.assigned_to ?? actor.profile.id;
    const { data: assignee } = await admin
      .from("user_profiles")
      .select("id, company_id, status")
      .eq("id", assignedUserId)
      .single();
    if (!assignee || assignee.company_id !== actor.profile.company_id || assignee.status !== "active") {
      return NextResponse.json({ error: "Invalid assignee" }, { status: 400 });
    }

    const { data: followUp, error } = await admin
      .from("follow_ups")
      .insert({
        company_id: actor.profile.company_id,
        lead_id: leadId,
        assigned_user_id: assignedUserId,
        due_at: dueDate.toISOString(),
        mode,
        purpose: payload.purpose?.trim() || null,
        outcome: payload.outcome?.trim() || null,
        priority,
        status,
        note: payload.note?.trim() || null,
        next_followup_at: nextFollowupIso,
        completed_at: status === "completed" ? new Date().toISOString() : null
      })
      .select("id")
      .single();
    if (error || !followUp) {
      return NextResponse.json({ error: error?.message ?? "Failed to create follow-up" }, { status: 400 });
    }

    await admin
      .from("leads")
      .update({
        next_followup_at: nextFollowupIso ?? dueDate.toISOString(),
        pipeline_stage: "follow_up_due",
        updated_at: new Date().toISOString()
      })
      .eq("id", leadId)
      .eq("company_id", actor.profile.company_id);

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "follow_up",
      entityId: followUp.id,
      action: "followup.created",
      description: `Follow-up created for ${lead.full_name}`
    });

    await createNotification(admin, {
      companyId: actor.profile.company_id,
      userProfileId: assignedUserId,
      notificationType: "assignment",
      eventType: "followup.created",
      entityType: "follow_up",
      entityId: followUp.id,
      actionUrl: "/follow-ups",
      title: "Follow-up assigned",
      message: `${lead.full_name} follow-up scheduled for ${dueDate.toLocaleString()}.`,
      payload: {
        leadId,
        followUpId: followUp.id
      }
    });

    return NextResponse.json({ success: true, id: followUp.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
