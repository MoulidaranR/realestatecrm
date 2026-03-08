import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getActorContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  let actor;
  try {
    actor = await getActorContext();
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      redirect("/login");
    }
    if (error instanceof Error && error.message === "User profile not found") {
      redirect("/invite/accept");
    }
    throw error;
  }

  if (actor.profile.status !== "active") {
    redirect("/invite/accept");
  }

  const supabase = await createServerSupabaseClient();

  const [{ count: unreadNotifications }, { data: company }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("company_id", actor.profile.company_id)
      .eq("user_profile_id", actor.profile.id)
      .eq("is_read", false),
    supabase
      .from("companies")
      .select("name")
      .eq("id", actor.profile.company_id)
      .single()
  ]);

  return (
    <DashboardShell
      profile={actor.profile}
      companyName={company?.name ?? undefined}
      unreadNotifications={unreadNotifications ?? 0}
    >
      {children}
    </DashboardShell>
  );
}
