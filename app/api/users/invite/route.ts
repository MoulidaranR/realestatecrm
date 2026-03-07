import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ROLE_KEYS, type RoleKey } from "@/lib/constants";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "users.invite");

    const payload = (await request.json()) as {
      fullName?: string;
      email?: string;
      roleKey?: RoleKey;
    };

    const fullName = payload.fullName?.trim();
    const email = payload.email?.trim().toLowerCase();
    const roleKey = payload.roleKey;

    if (!fullName || !email || !roleKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!ROLE_KEYS.includes(roleKey)) {
      return NextResponse.json({ error: "Invalid role key" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${env.NEXT_PUBLIC_APP_URL}/invite/accept`
      }
    );

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    const { error: upsertError } = await admin.from("user_profiles").upsert(
      {
        auth_user_id: invitedUser.user?.id ?? null,
        company_id: actor.profile.company_id,
        full_name: fullName,
        email,
        role_key: roleKey,
        status: "invited"
      },
      {
        onConflict: "company_id,email"
      }
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 });
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "user",
      entityId: invitedUser.user?.id ?? null,
      action: "user.invited",
      description: `Invited ${email} as ${roleKey}`
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
