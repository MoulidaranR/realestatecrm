import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as { fullName?: string };
  const fullName = payload.fullName?.trim();
  if (!fullName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: existingProfile } = await admin
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: invitedProfile, error: invitedProfileError } = await admin
    .from("user_profiles")
    .select("id")
    .eq("email", user.email.toLowerCase())
    .eq("status", "invited")
    .limit(1)
    .maybeSingle();

  const targetProfileId = existingProfile?.id ?? invitedProfile?.id;
  if (invitedProfileError || !targetProfileId) {
    return NextResponse.json(
      { error: "No pending invite profile found for this user" },
      { status: 404 }
    );
  }

  const { error: updateError } = await admin
    .from("user_profiles")
    .update({
      auth_user_id: user.id,
      full_name: fullName,
      status: "active"
    })
    .eq("id", targetProfileId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, company_id")
    .eq("id", targetProfileId)
    .single();
  if (profile) {
    await logActivity(admin, {
      companyId: profile.company_id,
      actorUserId: profile.id,
      entityType: "user",
      entityId: profile.id,
      action: "user.invite_accepted",
      description: "User completed invite onboarding"
    });
  }

  return NextResponse.json({ success: true });
}
