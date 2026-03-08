import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { MANAGED_ROLE_KEYS, type RoleKey } from "@/lib/constants";
import { getActorContext, requireCompanyAdmin, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

function isValidPhone(value: string): boolean {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized.length >= 8 && normalized.length <= 16;
}

export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "users.invite");
    requireCompanyAdmin(actor);

    const payload = (await request.json()) as {
      fullName?: string;
      email?: string;
      phone?: string;
      roleKey?: RoleKey;
    };

    const fullName = payload.fullName?.trim();
    const email = payload.email?.trim().toLowerCase();
    const phone = payload.phone?.trim() || null;
    const roleKey = payload.roleKey;

    if (!fullName || !email || !roleKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (phone && !isValidPhone(phone)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }
    if (!MANAGED_ROLE_KEYS.includes(roleKey)) {
      return NextResponse.json({ error: "Invalid role key" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: existingProfile } = await admin
      .from("user_profiles")
      .select("id, status, role_key, full_name, phone")
      .eq("company_id", actor.profile.company_id)
      .eq("email", email)
      .maybeSingle();

    if (existingProfile?.status === "active") {
      return NextResponse.json(
        { error: "User already active in this company. Edit the user instead." },
        { status: 400 }
      );
    }

    const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${env.NEXT_PUBLIC_APP_URL}/invite/accept`
      }
    );

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    const invitedAt = new Date().toISOString();
    const { data: profile, error: upsertError } = await admin
      .from("user_profiles")
      .upsert(
        {
          auth_user_id: invitedUser.user?.id ?? null,
          company_id: actor.profile.company_id,
          full_name: fullName,
          email,
          phone,
          role_key: roleKey,
          status: "invited"
        },
        {
          onConflict: "company_id,email"
        }
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
      entityId: profile?.id ?? null,
      action: "user.invited",
      description: `Invited ${email} as ${roleKey}`,
      before: existingProfile
        ? {
            status: existingProfile.status,
            roleKey: existingProfile.role_key,
            fullName: existingProfile.full_name,
            phone: existingProfile.phone
          }
        : {},
      after: {
        status: "invited",
        roleKey,
        fullName,
        phone,
        invitedAt
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
