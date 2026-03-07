import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      fullName?: string;
      companyName?: string;
      email?: string;
      password?: string;
    };

    const fullName = payload.fullName?.trim();
    const companyName = payload.companyName?.trim();
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;

    if (!fullName || !companyName || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const admin = createAdminSupabaseClient();
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: userError?.message ?? "Failed to create auth user" },
        { status: 400 }
      );
    }

    const userId = userData.user.id;
    const companySlug = `${slugify(companyName)}-${Math.floor(Math.random() * 10000)}`;

    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({
        name: companyName,
        slug: companySlug,
        email,
        status: "active",
        plan: "starter"
      })
      .select("id")
      .single();

    if (companyError || !company) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: companyError?.message ?? "Failed to create company" },
        { status: 400 }
      );
    }

    const { error: profileError } = await admin.from("user_profiles").insert({
      auth_user_id: userId,
      company_id: company.id,
      full_name: fullName,
      email,
      role_key: "company_admin",
      status: "active"
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      await admin.from("companies").delete().eq("id", company.id);
      return NextResponse.json(
        { error: profileError.message ?? "Failed to create user profile" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
