import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import type { UserProfile } from "@/lib/db-types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type DashboardShellProps = {
  profile: UserProfile;
  children: React.ReactNode;
};

export async function DashboardShell({ profile, children }: DashboardShellProps) {
  const supabase = await createServerSupabaseClient();
  const { count: unreadNotifications } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id)
    .eq("user_profile_id", profile.id)
    .eq("is_read", false);

  return (
    <div className="min-h-screen bg-background-light text-slate-900 lg:flex">
      <Sidebar roleKey={profile.role_key} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          fullName={profile.full_name}
          roleKey={profile.role_key}
          unreadNotifications={unreadNotifications ?? 0}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
