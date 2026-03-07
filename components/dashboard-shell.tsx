import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import type { UserProfile } from "@/lib/db-types";

type DashboardShellProps = {
  profile: UserProfile;
  children: React.ReactNode;
};

export function DashboardShell({ profile, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-background-light text-slate-900 lg:flex">
      <Sidebar roleKey={profile.role_key} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar fullName={profile.full_name} roleKey={profile.role_key} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
