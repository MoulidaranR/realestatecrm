import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const actor = await getActorContext();
    const admin = createAdminSupabaseClient();
    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "auth",
      action: "user.logout",
      description: "User signed out"
    });
  } catch {
    // Logout should still complete even when actor context cannot be resolved.
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
