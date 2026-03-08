import { redirect } from "next/navigation";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { UsersPageClient } from "@/components/users-page-client";
import type { UserProfile } from "@/lib/db-types";

export default async function UsersPage() {
  const actor = await getActorContext();
  try {
    requireCompanyAdmin(actor);
  } catch {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: users }, { data: roles }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("*")
      .eq("company_id", actor.profile.company_id)
      .order("full_name"),
    supabase
      .from("roles")
      .select("role_key, role_name, is_system, is_protected, description, scope")
      .or(`company_id.is.null,company_id.eq.${actor.profile.company_id}`)
      .order("is_system", { ascending: false })
      .order("role_name")
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        subtitle="Manage your team — add, configure, and control access for each member."
        breadcrumbs={[{ label: "Management" }, { label: "Users" }]}
      />
      <UsersPageClient
        users={(users ?? []) as UserProfile[]}
        roles={roles ?? []}
        currentUserId={actor.profile.id}
      />
    </div>
  );
}
