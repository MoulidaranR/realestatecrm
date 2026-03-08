import { NextResponse } from "next/server";
import { getActorContext, requireCompanyAdmin, requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function isValidPhone(value: string): boolean {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized.length >= 8 && normalized.length <= 16;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "users.update_status");
    requireCompanyAdmin(actor);
    const { id } = await context.params;

    const payload = (await request.json()) as {
      fullName?: string;
      phone?: string | null;
    };

    const fullName = payload.fullName?.trim();
    const phone = payload.phone?.trim() || null;
    if (!fullName) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }
    if (phone && !isValidPhone(phone)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: target, error: targetError } = await admin
      .from("user_profiles")
      .select("id, company_id, full_name, phone")
      .eq("id", id)
      .single();

    if (targetError || !target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: updateError } = await admin
      .from("user_profiles")
      .update({
        full_name: fullName,
        phone
      })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "user",
      entityId: id,
      action: "user.profile_updated",
      description: `Updated profile details for ${fullName}`,
      before: {
        fullName: target.full_name,
        phone: target.phone
      },
      after: {
        fullName,
        phone
      }
    });

    if (id !== actor.profile.id) {
      await createNotification(admin, {
        companyId: actor.profile.company_id,
        userProfileId: id,
        notificationType: "user_management",
        eventType: "user.profile_updated",
        entityType: "user",
        entityId: id,
        actionUrl: "/users",
        title: "Profile details updated",
        message: "Your profile details were updated by a company admin."
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
