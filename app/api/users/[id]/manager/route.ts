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
    await requirePermission(actor, "users.update_manager");
    const { id } = await context.params;

    const payload = (await request.json()) as { managerUserId?: string | null };
    const managerUserId = payload.managerUserId ?? null;
    if (managerUserId === id) {
      return NextResponse.json(
        { error: "User cannot be assigned as their own manager" },
        { status: 400 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: target, error: targetError } = await admin
      .from("user_profiles")
      .select("id, company_id")
      .eq("id", id)
      .single();

    if (targetError || !target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (target.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (managerUserId) {
      const { data: manager, error: managerError } = await admin
        .from("user_profiles")
        .select("id, company_id, role_key, status")
        .eq("id", managerUserId)
        .single();
      if (managerError || !manager) {
        return NextResponse.json({ error: "Manager user not found" }, { status: 404 });
      }
      if (manager.company_id !== actor.profile.company_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (manager.status !== "active") {
        return NextResponse.json({ error: "Manager must be active" }, { status: 400 });
      }
      if (manager.role_key !== "manager" && manager.role_key !== "company_admin") {
        return NextResponse.json({ error: "Invalid manager role" }, { status: 400 });
      }
    }

    const { error: updateError } = await admin
      .from("user_profiles")
      .update({ manager_user_id: managerUserId })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "user",
      entityId: id,
      action: "user.manager_assigned",
      description: managerUserId
        ? `Manager assigned: ${managerUserId}`
        : "Manager assignment cleared",
      metadata: {
        managerUserId
      }
    });

    if (managerUserId) {
      await createNotification(admin, {
        companyId: actor.profile.company_id,
        userProfileId: id,
        eventType: "user.manager_assigned",
        title: "Reporting manager updated",
        message: "Your manager assignment has been updated.",
        payload: {
          managerUserId
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
