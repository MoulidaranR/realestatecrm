import { NextResponse } from "next/server";
import { ROLE_KEYS, type RoleKey } from "@/lib/constants";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "users.update_role");
    const { id } = await context.params;

    const payload = (await request.json()) as { roleKey?: RoleKey };
    const roleKey = payload.roleKey;
    if (!roleKey || !ROLE_KEYS.includes(roleKey)) {
      return NextResponse.json({ error: "Invalid role key" }, { status: 400 });
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

    const { error: updateError } = await admin
      .from("user_profiles")
      .update({ role_key: roleKey })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "user",
      entityId: id,
      action: "user.role_changed",
      description: `User role updated to ${roleKey}`
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
