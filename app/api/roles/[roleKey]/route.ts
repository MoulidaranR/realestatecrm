import { NextResponse } from "next/server";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

// DELETE /api/roles/[roleKey] — delete a custom role (not system/protected roles)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ roleKey: string }> }
) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);
    const { roleKey } = await params;

    const admin = createAdminSupabaseClient();

    // Fetch the role
    const { data: role } = await admin
      .from("roles")
      .select("role_key, role_name, is_system, is_protected, company_id")
      .eq("role_key", roleKey)
      .maybeSingle();

    if (!role) {
      return NextResponse.json({ error: "Role not found." }, { status: 404 });
    }

    if (role.is_protected) {
      return NextResponse.json(
        { error: `The "${role.role_name}" role is protected and cannot be deleted.` },
        { status: 403 }
      );
    }

    if (role.is_system) {
      return NextResponse.json(
        { error: `System role "${role.role_name}" cannot be deleted. You can edit its permissions instead.` },
        { status: 403 }
      );
    }

    if (role.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Check if any users still use this role
    const { data: users } = await admin
      .from("user_profiles")
      .select("id, full_name, status")
      .eq("company_id", actor.profile.company_id)
      .eq("role_key", roleKey)
      .neq("status", "disabled");

    if (users && users.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete role "${role.role_name}" — ${users.length} active user(s) still assigned to it. Reassign them first.`,
          users: users.map((u) => ({ id: u.id, name: u.full_name }))
        },
        { status: 409 }
      );
    }

    // Delete the role (cascade will handle role_permissions)
    const { error: deleteErr } = await admin.from("roles").delete().eq("role_key", roleKey);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "role",
      entityId: roleKey,
      action: "role.deleted",
      description: `Deleted custom role "${role.role_name}" (${roleKey})`
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 });
  }
}
