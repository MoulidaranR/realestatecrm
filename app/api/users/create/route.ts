import { NextResponse } from "next/server";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";

function isValidPhone(value: string): boolean {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized.length >= 8 && normalized.length <= 16;
}

export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);

    const payload = (await request.json()) as {
      fullName?: string;
      email?: string;
      phone?: string;
      password?: string;
      roleKey?: string;
      managerUserId?: string | null;
    };

    const fullName = payload.fullName?.trim();
    const email = payload.email?.trim().toLowerCase();
    const phone = payload.phone?.trim() || null;
    const password = payload.password;
    const roleKey = payload.roleKey?.trim();
    const managerUserId = payload.managerUserId ?? null;

    if (!fullName || !email || !roleKey || !password) {
      return NextResponse.json(
        { error: "Full name, email, password, and role are required." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (phone && !isValidPhone(phone)) {
      return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
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
    // Custom role must belong to this company
    if (role.company_id && role.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Invalid role for this company." }, { status: 400 });
    }

    // Check duplicate email in same company
    const { data: existingProfile } = await admin
      .from("user_profiles")
      .select("id, status")
      .eq("company_id", actor.profile.company_id)
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        {
          error: `Email "${email}" is already used by another account in this company (status: ${existingProfile.status}).`
        },
        { status: 400 }
      );
    }

    // Validate manager belongs to same company
    if (managerUserId) {
      const { data: manager } = await admin
        .from("user_profiles")
        .select("id, company_id, status")
        .eq("id", managerUserId)
        .single();
      if (!manager || manager.company_id !== actor.profile.company_id) {
        return NextResponse.json({ error: "Invalid manager selected." }, { status: 400 });
      }
      if (manager.status !== "active") {
        return NextResponse.json({ error: "Reporting manager must be active." }, { status: 400 });
      }
    }

    // Create Supabase auth user with confirmed email
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Failed to create auth account." },
        { status: 400 }
      );
    }

    // Create user profile in same company as admin
    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .insert({
        auth_user_id: authData.user.id,
        company_id: actor.profile.company_id,
        full_name: fullName,
        email,
        phone,
        role_key: roleKey,
        manager_user_id: managerUserId,
        status: "active"
      })
      .select("id")
      .single();

    if (profileError || !profile) {
      // Rollback auth user
      await admin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: profileError?.message ?? "Failed to create user profile." },
        { status: 400 }
      );
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "user",
      entityId: profile.id,
      action: "user.created",
      description: `Created user ${fullName} (${email}) as ${role.role_name}`,
      after: { fullName, email, roleKey, managerUserId, status: "active" }
    });

    await createNotification(admin, {
      companyId: actor.profile.company_id,
      userProfileId: profile.id,
      notificationType: "user_management",
      eventType: "user.created",
      entityType: "user",
      entityId: profile.id,
      actionUrl: "/users",
      title: "Welcome to the CRM",
      message: `Your account has been created by ${actor.profile.full_name}. Sign in with your email and password.`
    });

    return NextResponse.json({ success: true, id: profile.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
