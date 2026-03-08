import { NextResponse } from "next/server";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ roleKey: string }> };

// GET /api/roles/[roleKey]/permissions
export async function GET(_req: Request, { params }: Params) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);
    const { roleKey } = await params;

    const supabase = await createServerSupabaseClient();

    const [{ data: allPerms }, { data: grantedPerms }, { data: role }] = await Promise.all([
      supabase.from("permissions").select("permission_key, description").order("permission_key"),
      supabase.from("role_permissions").select("permission_key").eq("role_key", roleKey),
      supabase.from("roles").select("role_key, role_name, is_system, is_protected, scope, description").eq("role_key", roleKey).maybeSingle()
    ]);

    if (!role) {
      return NextResponse.json({ error: "Role not found." }, { status: 404 });
    }

    return NextResponse.json({
      allPermissions: allPerms ?? [],
      grantedKeys: (grantedPerms ?? []).map((p) => p.permission_key),
      role
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 });
  }
}

// PUT /api/roles/[roleKey]/permissions
export async function PUT(request: Request, { params }: Params) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);
    const { roleKey } = await params;

    const body = (await request.json()) as {
      permissionKeys?: string[];
      scope?: string;
    };

    const admin = createAdminSupabaseClient();

    // Fetch role to enforce protection rules
    const { data: role } = await admin
      .from("roles")
      .select("role_key, role_name, is_protected, company_id")
      .eq("role_key", roleKey)
      .maybeSingle();

    if (!role) {
      return NextResponse.json({ error: "This role no longer exists. Please refresh and try again." }, { status: 404 });
    }

    if (role.is_protected) {
      return NextResponse.json(
        { error: `The "${role.role_name}" role is protected. Its permissions cannot be restricted.` },
        { status: 403 }
      );
    }

    // Custom roles must belong to this company
    if (role.company_id && role.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Update scope if provided
    if (body.scope) {
      await admin.from("roles").update({ scope: body.scope }).eq("role_key", roleKey);
    }

    // Replace permissions atomically
    if (body.permissionKeys !== undefined) {
      await admin.from("role_permissions").delete().eq("role_key", roleKey);

      if (body.permissionKeys.length > 0) {
        // Validate all provided keys exist
        const { data: validPerms } = await admin
          .from("permissions")
          .select("permission_key")
          .in("permission_key", body.permissionKeys);

        const validKeys = (validPerms ?? []).map((p) => p.permission_key);

        if (validKeys.length > 0) {
          await admin.from("role_permissions").insert(
            validKeys.map((pk) => ({ role_key: roleKey, permission_key: pk }))
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 });
  }
}
