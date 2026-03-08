import { NextResponse } from "next/server";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PERMISSION_KEYS } from "@/lib/constants";
import { mapDbError } from "@/lib/errors";

type Context = { params: Promise<{ roleKey: string }> };

export async function GET(_req: Request, { params }: Context) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);
    const { roleKey } = await params;
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("role_permissions")
      .select("permission_key")
      .eq("role_key", roleKey);
    if (error) return NextResponse.json({ error: mapDbError(error, "GET role permissions") }, { status: 500 });
    return NextResponse.json({ permissionKeys: (data ?? []).map((p) => p.permission_key) });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    return NextResponse.json({ error: mapDbError(err, "GET role permissions") }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Context) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);

    const { roleKey } = await params;
    if (roleKey === "company_admin") {
      return NextResponse.json(
        { error: "Company Admin permissions cannot be modified." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as { permissionKeys?: string[] };
    const permissionKeys = (body.permissionKeys ?? []).filter(
      (k): k is (typeof PERMISSION_KEYS)[number] => PERMISSION_KEYS.includes(k as never)
    );

    const supabase = await createServerSupabaseClient();

    // Verify role exists
    const { data: role } = await supabase
      .from("roles")
      .select("role_key")
      .eq("role_key", roleKey)
      .single();
    if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });

    // Replace all permissions for this role
    const { error: deleteError } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_key", roleKey);
    if (deleteError) {
      return NextResponse.json({ error: mapDbError(deleteError, "delete role permissions") }, { status: 500 });
    }

    if (permissionKeys.length > 0) {
      const rows = permissionKeys.map((pk) => ({ role_key: roleKey, permission_key: pk }));
      const { error: insertError } = await supabase.from("role_permissions").insert(rows);
      if (insertError) {
        return NextResponse.json({ error: mapDbError(insertError, "insert role permissions") }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    return NextResponse.json({ error: mapDbError(err, "PUT role permissions") }, { status: 500 });
  }
}
