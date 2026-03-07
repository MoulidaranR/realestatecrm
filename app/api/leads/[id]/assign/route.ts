import { NextResponse } from "next/server";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "leads.assign");
    const { id } = await context.params;

    const payload = (await request.json()) as { assigneeUserId?: string | null };
    const assigneeUserId = payload.assigneeUserId ?? null;

    const admin = createAdminSupabaseClient();
    const { data: lead, error: leadError } = await admin
      .from("leads")
      .select("id, company_id, assigned_to, full_name")
      .eq("id", id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (lead.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (assigneeUserId) {
      const { data: assignee, error: assigneeError } = await admin
        .from("user_profiles")
        .select("id, company_id, status")
        .eq("id", assigneeUserId)
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
    }

    const { error: updateError } = await admin
      .from("leads")
      .update({ assigned_to: assigneeUserId, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "lead",
      entityId: id,
      action: "lead.assigned",
      description: assigneeUserId ? `Lead assigned to ${assigneeUserId}` : "Lead unassigned",
      metadata: {
        assigneeUserId
      },
      before: {
        assignedTo: lead.assigned_to
      },
      after: {
        assignedTo: assigneeUserId
      }
    });

    if (assigneeUserId) {
      await createNotification(admin, {
        companyId: actor.profile.company_id,
        userProfileId: assigneeUserId,
        notificationType: "assignment",
        eventType: "lead.assigned",
        entityType: "lead",
        entityId: id,
        actionUrl: `/leads/${id}`,
        title: "New lead assigned",
        message: `${lead.full_name} has been assigned to you.`,
        payload: {
          leadId: id
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
