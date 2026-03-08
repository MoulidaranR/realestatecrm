import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getActorContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { RolePermissionsClient } from "@/components/role-permissions-client";

export default async function RoleDetailPage({
  params
}: {
  params: Promise<{ roleKey: string }>;
}) {
  const { roleKey } = await params;
  const actor = await getActorContext();
  if (actor.profile.role_key !== "company_admin") {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();


  const [{ data: role }, { data: allPerms }, { data: grantedPerms }] = await Promise.all([
    supabase.from("roles").select("role_key, role_name").eq("role_key", roleKey).single(),
    supabase.from("permissions").select("permission_key, description").order("permission_key"),
    supabase.from("role_permissions").select("permission_key").eq("role_key", roleKey)
  ]);

  if (!role) notFound();

  const grantedKeys = (grantedPerms ?? []).map((p) => p.permission_key);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${role.role_name} — Permissions`}
        subtitle={`Configure what users with the '${role.role_name}' role can access.`}
        breadcrumbs={[
          { label: "Management" },
          { label: "Roles & Permissions", href: "/roles" },
          { label: role.role_name }
        ]}
        actions={
          <Link
            href="/roles"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Back to Roles
          </Link>
        }
      />
      <RolePermissionsClient
        roleKey={roleKey}
        roleName={role.role_name}
        allPermissions={allPerms ?? []}
        grantedKeys={grantedKeys}
      />
    </div>
  );
}
