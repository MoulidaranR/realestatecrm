"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { ToastProvider } from "@/components/ui/toast";
import type { UserProfile } from "@/lib/db-types";

type DashboardShellProps = {
  profile: UserProfile;
  companyName?: string;
  unreadNotifications: number;
  children: React.ReactNode;
};

export function DashboardShell({ profile, companyName, unreadNotifications, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-surface-muted">
        {/* Sidebar */}
        <Sidebar
          roleKey={profile.role_key}
          fullName={profile.full_name}
          companyName={companyName}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar
            fullName={profile.full_name}
            roleKey={profile.role_key}
            unreadNotifications={unreadNotifications}
            onMenuToggle={() => setMobileOpen((prev) => !prev)}
          />
          {/* Page content — scrolls independently */}
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="mx-auto max-w-screen-2xl px-5 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
