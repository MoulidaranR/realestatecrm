import { NextResponse } from "next/server";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { refreshLeadAutomation } from "@/lib/lead-automation";

export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "leads.create");

    const payload = (await request.json()) as {
      fullName?: string;
      phone?: string;
      city?: string;
      preferredLocation?: string;
      source?: string;
    };

    const fullName = payload.fullName?.trim();
    const phone = payload.phone?.trim();
    const city = payload.city?.trim() || null;
    const preferredLocation = payload.preferredLocation?.trim() || null;
    const source = payload.source?.trim() || "manual";

    if (!fullName || !phone) {
      return NextResponse.json(
        { error: "Full name and phone are required" },
        { status: 400 }
      );
    }

    const defaultAssignee =
      actor.profile.role_key === "telecaller" || actor.profile.role_key === "sales_executive"
        ? actor.profile.id
        : null;

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("leads")
      .insert({
        company_id: actor.profile.company_id,
        created_by: actor.profile.id,
        assigned_to: defaultAssignee,
        full_name: fullName,
        phone,
        city,
        preferred_location: preferredLocation,
        source,
        pipeline_stage: "new",
        lead_status: "open"
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create lead" },
        { status: 400 }
      );
    }

    await refreshLeadAutomation(admin, data.id, actor.profile.company_id);

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "lead",
      entityId: data.id,
      action: "lead.created",
      description: `Lead ${fullName} created`
    });

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
