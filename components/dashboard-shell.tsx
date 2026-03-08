"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import type { UserProfile } from "@/lib/db-types";

type DashboardShellProps = {
  profile: UserProfile;
  unreadNotifications: number;
  children: React.ReactNode;
};

export function DashboardShell({ profile, unreadNotifications, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background-light text-slate-900 lg:flex">
      <Sidebar
        roleKey={profile.role_key}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          fullName={profile.full_name}
          roleKey={profile.role_key}
          unreadNotifications={unreadNotifications}
          onMenuToggle={() => setMobileOpen((prev) => !prev)}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
