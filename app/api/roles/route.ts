import { NextResponse } from "next/server";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

// GET /api/roles — list all roles (system + company custom)
export async function GET() {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);

    const supabase = await createServerSupabaseClient();

    // Fetch system roles (company_id IS NULL) + custom roles for this company
    const { data: roles, error } = await supabase
      .from("roles")
      .select("role_key, role_name, description, scope, is_system, is_protected, company_id, updated_at")
      .or(`company_id.is.null,company_id.eq.${actor.profile.company_id}`)
      .order("is_system", { ascending: false })
      .order("role_name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Count active users per role
    const { data: userCounts } = await supabase
      .from("user_profiles")
      .select("role_key")
      .eq("company_id", actor.profile.company_id)
      .eq("status", "active");

    const countMap: Record<string, number> = {};
    for (const u of userCounts ?? []) {
      countMap[u.role_key] = (countMap[u.role_key] ?? 0) + 1;
    }

    const enriched = (roles ?? []).map((r) => ({
      ...r,
      user_count: countMap[r.role_key] ?? 0
    }));

    return NextResponse.json({ roles: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 });
  }
}

// POST /api/roles — create custom role
export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);

    const body = (await request.json()) as {
      roleName?: string;
      roleKey?: string;
      description?: string;
      scope?: string;
      copyFromRoleKey?: string;
    };

    const roleName = body.roleName?.trim();
    const rawKey = body.roleKey?.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const description = body.description?.trim() ?? "";
    const scope = body.scope ?? "company";
    const copyFromRoleKey = body.copyFromRoleKey?.trim() || null;

    if (!roleName || !rawKey) {
      return NextResponse.json({ error: "Role name and key are required." }, { status: 400 });
    }
    if (!/^[a-z][a-z0-9_]{1,49}$/.test(rawKey)) {
      return NextResponse.json(
        { error: "Role key must be 2–50 lowercase letters, digits, or underscores, starting with a letter." },
        { status: 400 }
      );
    }
    if (!["own", "team", "company"].includes(scope)) {
      return NextResponse.json({ error: "Invalid scope." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    // Check uniqueness
    const { data: existing } = await admin
      .from("roles")
      .select("role_key")
      .eq("role_key", rawKey)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: `Role key "${rawKey}" already exists.` }, { status: 400 });
    }

    // Create the role
    const { data: newRole, error: insertErr } = await admin
      .from("roles")
      .insert({
        role_key: rawKey,
        role_name: roleName,
        description,
        scope,
        is_system: false,
        is_protected: false,
        company_id: actor.profile.company_id
      })
      .select("role_key")
      .single();

    if (insertErr || !newRole) {
      return NextResponse.json({ error: insertErr?.message ?? "Failed to create role." }, { status: 500 });
    }

    // Copy permissions from source role if specified
    if (copyFromRoleKey) {
      const { data: sourcePerms } = await admin
        .from("role_permissions")
        .select("permission_key")
        .eq("role_key", copyFromRoleKey);

      if (sourcePerms && sourcePerms.length > 0) {
        await admin.from("role_permissions").insert(
          sourcePerms.map((p) => ({ role_key: rawKey, permission_key: p.permission_key }))
        );
      }
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "role",
      entityId: rawKey,
      action: "role.created",
      description: `Created custom role "${roleName}" (${rawKey})`,
      after: { roleName, roleKey: rawKey, scope, copyFromRoleKey }
    });

    return NextResponse.json({ success: true, roleKey: rawKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 });
  }
}
