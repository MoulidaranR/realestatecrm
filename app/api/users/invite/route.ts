import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);

    const payload = (await request.json()) as {
      email?: string;
      roleKey?: string;
      managerUserId?: string | null;
    };

    const email = payload.email?.trim().toLowerCase();
    const roleKey = payload.roleKey?.trim();
    const managerUserId = payload.managerUserId ?? null;

    if (!email || !roleKey) {
      return NextResponse.json({ error: "Email and role are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    // Validate role exists (system or company custom)
    const { data: role } = await admin
      .from("roles")
      .select("role_key, role_name, company_id")
      .eq("role_key", roleKey)
      .maybeSingle();

    if (!role) {
      return NextResponse.json(
        { error: `Role "${roleKey}" does not exist. Please refresh and try again.` },
        { status: 400 }
      );
    }
    if (role.company_id && role.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Invalid role for this company." }, { status: 400 });
    }

    // Check duplicate in same company
    const { data: existingProfile } = await admin
      .from("user_profiles")
      .select("id, status, role_key, full_name")
      .eq("company_id", actor.profile.company_id)
      .eq("email", email)
      .maybeSingle();

    if (existingProfile?.status === "active") {
      return NextResponse.json(
        { error: `"${email}" is already an active user in this company.` },
        { status: 400 }
      );
    }

    // Validate manager if provided
    if (managerUserId) {
      const { data: manager } = await admin
        .from("user_profiles")
        .select("id, company_id, status")
        .eq("id", managerUserId)
        .single();
      if (!manager || manager.company_id !== actor.profile.company_id || manager.status !== "active") {
        return NextResponse.json({ error: "Invalid or inactive manager selected." }, { status: 400 });
      }
    }

    // Send Supabase invite email
    const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${env.NEXT_PUBLIC_APP_URL}/invite/accept` }
    );

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    const invitedAt = new Date().toISOString();

    // Upsert user profile
    const { data: profile, error: upsertError } = await admin
      .from("user_profiles")
      .upsert(
        {
          auth_user_id: invitedUser.user?.id ?? null,
          company_id: actor.profile.company_id,
          full_name: email.split("@")[0], // placeholder until user sets it
          email,
          role_key: roleKey,
          manager_user_id: managerUserId,
          status: "invited",
          invited_by: actor.profile.id,
          invited_at: invitedAt
        },
        { onConflict: "company_id,email" }
      )
      .select("id")
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 });
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "user",
      entityId: profile?.id ?? "",
      action: "user.invited",
      description: `Invited ${email} as ${role.role_name}`,
      after: { email, roleKey, managerUserId, status: "invited", invitedAt }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
