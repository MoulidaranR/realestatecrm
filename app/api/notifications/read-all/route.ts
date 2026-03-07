import { NextResponse } from "next/server";
import { getActorContext, hasPermission, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function PATCH() {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "notifications.read");
    const canManage = await hasPermission(actor.profile.role_key, "notifications.manage");

    const admin = createAdminSupabaseClient();
    let query = admin
      .from("notifications")
      .update({ is_read: true })
      .eq("company_id", actor.profile.company_id)
      .eq("is_read", false);

    if (!canManage) {
      query = query.eq("user_profile_id", actor.profile.id);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
