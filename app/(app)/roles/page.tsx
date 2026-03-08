import { redirect } from "next/navigation";
import { getActorContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { RolesPageClient } from "@/components/roles-page-client";

export default async function RolesPage() {
  const actor = await getActorContext();
  if (actor.profile.role_key !== "company_admin") {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: roles }, { data: userCounts }, { data: permCounts }] = await Promise.all([
    supabase
      .from("roles")
      .select("role_key, role_name, description, scope, is_system, is_protected, company_id, updated_at")
      .or(`company_id.is.null,company_id.eq.${actor.profile.company_id}`)
      .order("is_system", { ascending: false })
      .order("role_name"),
    supabase
      .from("user_profiles")
      .select("role_key")
      .eq("company_id", actor.profile.company_id)
      .eq("status", "active"),
    supabase
      .from("role_permissions")
      .select("role_key")
  ]);

  const countMap = new Map<string, number>();
  for (const u of userCounts ?? []) {
    countMap.set(u.role_key, (countMap.get(u.role_key) ?? 0) + 1);
  }

  const permMap = new Map<string, number>();
  for (const p of permCounts ?? []) {
    permMap.set(p.role_key, (permMap.get(p.role_key) ?? 0) + 1);
  }

  const enrichedRoles = (roles ?? []).map((r) => ({
    ...r,
    user_count: countMap.get(r.role_key) ?? 0,
    perm_count: permMap.get(r.role_key) ?? 0
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define what each role can access and do in the CRM. Create custom roles for your business needs."
        breadcrumbs={[{ label: "Management" }, { label: "Roles & Permissions" }]}
      />
      <RolesPageClient roles={enrichedRoles} />
    </div>
  );
}
