import { NextResponse } from "next/server";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

// GET /api/users/[id]/permissions — return effective permissions + override layer
export async function GET(_req: Request, { params }: Params) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);
    const { id } = await params;

    const supabase = await createServerSupabaseClient();

    // Verify user belongs to same company
    const { data: user } = await supabase
      .from("user_profiles")
      .select("id, role_key, access_mode, company_id")
      .eq("id", id)
      .eq("company_id", actor.profile.company_id)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Fetch role permissions
    const { data: rolePerms } = await supabase
      .from("role_permissions")
      .select("permission_key")
      .eq("role_key", user.role_key);

    // Fetch all permissions for the matrix
    const { data: allPerms } = await supabase
      .from("permissions")
      .select("permission_key, description")
      .order("permission_key");

    // Fetch current overrides
    const { data: overrides } = await supabase
      .from("user_permission_overrides")
      .select("permission_key, allowed")
      .eq("user_profile_id", id);

    const roleGranted = new Set((rolePerms ?? []).map((p) => p.permission_key));
    const overrideMap: Record<string, boolean> = {};
    for (const o of overrides ?? []) {
      overrideMap[o.permission_key] = o.allowed;
    }

    return NextResponse.json({
      userId: id,
      roleKey: user.role_key,
      accessMode: user.access_mode,
      roleGranted: Array.from(roleGranted),
      overrides: overrideMap,
      allPermissions: allPerms ?? []
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 });
  }
}

// PUT /api/users/[id]/permissions — save per-user permission overrides
export async function PUT(request: Request, { params }: Params) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);
    const { id } = await params;

    const body = (await request.json()) as {
      accessMode?: "role_only" | "custom_override";
      overrides?: Record<string, boolean>; // permissionKey → allowed
    };

    const admin = createAdminSupabaseClient();

    // Verify user belongs to same company
    const { data: user } = await admin
      .from("user_profiles")
      .select("id, company_id")
      .eq("id", id)
      .eq("company_id", actor.profile.company_id)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Update access_mode
    if (body.accessMode) {
      await admin
        .from("user_profiles")
        .update({ access_mode: body.accessMode })
        .eq("id", id);
    }

    // Replace overrides if provided
    if (body.overrides !== undefined) {
      // Delete all existing overrides for this user
      await admin.from("user_permission_overrides").delete().eq("user_profile_id", id);

      // Insert new ones
      const entries = Object.entries(body.overrides);
      if (entries.length > 0) {
        await admin.from("user_permission_overrides").insert(
          entries.map(([permission_key, allowed]) => ({
            user_profile_id: id,
            permission_key,
            allowed
          }))
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 });
  }
}
