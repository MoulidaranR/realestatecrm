import { NextResponse } from "next/server";
import type { UserStatus } from "@/lib/db-types";
import { getActorContext, requireCompanyAdmin, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";

const USER_STATUSES: UserStatus[] = ["active", "invited", "disabled"];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "users.update_status");
    requireCompanyAdmin(actor);
    const { id } = await context.params;

    const payload = (await request.json()) as { status?: UserStatus };
    const status = payload.status;
    if (!status || !USER_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: target, error: targetError } = await admin
      .from("user_profiles")
      .select("id, company_id, role_key, status, full_name")
      .eq("id", id)
      .single();

    if (targetError || !target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      target.role_key === "company_admin" &&
      target.status === "active" &&
      status !== "active"
    ) {
      const { count: activeAdmins } = await admin
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", actor.profile.company_id)
        .eq("role_key", "company_admin")
        .eq("status", "active");

      if ((activeAdmins ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Cannot deactivate the last active company admin" },
          { status: 400 }
        );
      }
    }

    const { error: updateError } = await admin
      .from("user_profiles")
      .update({ status })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "user",
      entityId: id,
      action: "user.status_changed",
      description: `${target.full_name} status updated to ${status}`,
      before: {
        status: target.status
      },
      after: {
        status
      }
    });

    await createNotification(admin, {
      companyId: actor.profile.company_id,
      userProfileId: id,
      notificationType: "user_management",
      eventType: "user.status_changed",
      entityType: "user",
      entityId: id,
      actionUrl: "/users",
      title: "Account status updated",
      message: `Your account status has been set to ${status}.`
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
