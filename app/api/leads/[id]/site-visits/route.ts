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
    await requirePermission(actor, "site_visits.manage");
    const { id } = await context.params;

    const payload = (await request.json()) as {
      visitDate?: string;
      assignedSalesUserId?: string | null;
      pickupRequired?: boolean;
      outcomeNote?: string;
    };

    const visitDateInput = payload.visitDate?.trim();
    const outcomeNote = payload.outcomeNote?.trim() || null;
    if (!visitDateInput) {
      return NextResponse.json({ error: "Visit date is required" }, { status: 400 });
    }
    const visitDate = new Date(visitDateInput);
    if (Number.isNaN(visitDate.valueOf())) {
      return NextResponse.json({ error: "Invalid visit date" }, { status: 400 });
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

    const assignedSalesUserId = payload.assignedSalesUserId ?? lead.assigned_to ?? actor.profile.id;
    const { data: assignee, error: assigneeError } = await admin
      .from("user_profiles")
      .select("id, company_id, role_key, status")
      .eq("id", assignedSalesUserId)
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

    const { error: visitError } = await admin.from("site_visits").insert({
      company_id: actor.profile.company_id,
      lead_id: id,
      assigned_sales_user_id: assignedSalesUserId,
      visit_date: visitDate.toISOString(),
      visit_status: "scheduled",
      pickup_required: Boolean(payload.pickupRequired),
      outcome_note: outcomeNote
    });
    if (visitError) {
      return NextResponse.json({ error: visitError.message }, { status: 400 });
    }

    const { error: updateError } = await admin
      .from("leads")
      .update({
        pipeline_stage: "site_visit_planned",
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
      entityType: "site_visit",
      entityId: null,
      action: "site_visit.created",
      description: "Site visit scheduled",
      metadata: {
        leadId: id,
        assignedSalesUserId,
        visitDate: visitDate.toISOString()
      }
    });

    await createNotification(admin, {
      companyId: actor.profile.company_id,
      userProfileId: assignedSalesUserId,
      eventType: "site_visit.scheduled",
      title: "Site visit scheduled",
      message: `Site visit scheduled for ${visitDate.toLocaleString()}.`,
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
