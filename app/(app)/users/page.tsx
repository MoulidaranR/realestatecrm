import { redirect } from "next/navigation";
import { UsersPageClient } from "@/components/users-page-client";
import type { UserProfile } from "@/lib/db-types";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function UsersPage() {
  const actor = await getActorContext();
  try {
    requireCompanyAdmin(actor);
  } catch {
    redirect("/dashboard");
  }

  const admin = createAdminSupabaseClient();
  const { data: users } = await admin
    .from("user_profiles")
    .select("*")
    .eq("company_id", actor.profile.company_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500">
          Manage your team — add users, assign roles, set managers, and activate or deactivate accounts.
        </p>
      </div>
      <UsersPageClient users={(users ?? []) as UserProfile[]} />
    </div>
  );
}
