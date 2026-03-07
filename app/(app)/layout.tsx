import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import type { UserProfile } from "@/lib/db-types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) {
    redirect("/invite/accept");
  }

  if (profile.status !== "active") {
    redirect("/invite/accept");
  }

  return (
    <DashboardShell profile={profile as UserProfile}>
      {children}
    </DashboardShell>
  );
}
