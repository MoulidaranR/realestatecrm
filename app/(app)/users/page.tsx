import { redirect } from "next/navigation";
import { UsersPageClient } from "@/components/users-page-client";
import type { UserProfile } from "@/lib/db-types";
import { getActorContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function UsersPage() {
  const actor = await getActorContext();
  if (actor.profile.role_key !== "company_admin") {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const [{ data: users }, { data: managers }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("*")
      .eq("company_id", actor.profile.company_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_profiles")
      .select("id, full_name, role_key")
      .eq("company_id", actor.profile.company_id)
      .in("role_key", ["company_admin", "manager"])
      .eq("status", "active")
      .order("full_name", { ascending: true })
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500">
          Admin-only workspace user management with role, status, and reporting manager controls.
        </p>
      </div>
      <UsersPageClient
        users={(users ?? []) as UserProfile[]}
        managers={
          (managers ?? []) as Array<Pick<UserProfile, "id" | "full_name" | "role_key">>
        }
      />
    </div>
  );
}
