import { NextResponse } from "next/server";
import { getActorContext, hasPermission, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "notifications.read");
    const canManage = await hasPermission(actor.profile.role_key, "notifications.manage");
    const { id } = await context.params;

    const admin = createAdminSupabaseClient();
    const { data: notification, error: fetchError } = await admin
      .from("notifications")
      .select("id, company_id, user_profile_id")
      .eq("id", id)
      .single();
    if (fetchError || !notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
    if (notification.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!canManage && notification.user_profile_id !== actor.profile.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: updateError } = await admin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
