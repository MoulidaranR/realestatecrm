import { NextResponse } from "next/server";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { refreshLeadAutomation } from "@/lib/lead-automation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "leads.update");
    const { id } = await context.params;

    const payload = (await request.json()) as {
      salesUserId?: string;
      dealValue?: number;
      bookingAmount?: number;
      dealStatus?: "open" | "booked" | "closed" | "lost";
    };

    const dealValue = Number(payload.dealValue ?? 0);
    const bookingAmount = Number(payload.bookingAmount ?? 0);
    const dealStatus = payload.dealStatus ?? "booked";
    if (!Number.isFinite(dealValue) || dealValue < 0) {
      return NextResponse.json({ error: "Invalid deal value" }, { status: 400 });
    }
    if (!Number.isFinite(bookingAmount) || bookingAmount < 0) {
      return NextResponse.json({ error: "Invalid booking amount" }, { status: 400 });
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

    const salesUserId = payload.salesUserId ?? lead.assigned_to ?? actor.profile.id;
    const { data: salesUser, error: salesError } = await admin
      .from("user_profiles")
      .select("id, company_id, status")
      .eq("id", salesUserId)
      .single();
    if (salesError || !salesUser) {
      return NextResponse.json({ error: "Sales user not found" }, { status: 404 });
    }
    if (salesUser.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (salesUser.status !== "active") {
      return NextResponse.json({ error: "Sales user must be active" }, { status: 400 });
    }

    const { data: deal, error: dealError } = await admin
      .from("deals")
      .insert({
        company_id: actor.profile.company_id,
        lead_id: id,
        sales_user_id: salesUserId,
        deal_value: dealValue,
        booking_amount: bookingAmount,
        deal_status: dealStatus,
        closed_at: dealStatus === "closed" ? new Date().toISOString() : null
      })
      .select("id")
      .single();
    if (dealError || !deal) {
      return NextResponse.json({ error: dealError?.message ?? "Failed to create deal" }, { status: 400 });
    }

    const leadStatus = dealStatus === "lost" ? "lost" : "won";
    await admin
      .from("leads")
      .update({
        lead_status: leadStatus,
        pipeline_stage: leadStatus === "won" ? "booked" : "lost",
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("company_id", actor.profile.company_id);

    await refreshLeadAutomation(admin, id, actor.profile.company_id);

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "deal",
      entityId: deal.id,
      action: "deal.created",
      description: `Deal created with status ${dealStatus}`,
      metadata: {
        leadId: id,
        dealValue,
        bookingAmount
      }
    });

    return NextResponse.json({ success: true, id: deal.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
