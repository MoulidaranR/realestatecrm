import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getActorContext } from "@/lib/auth";

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

  return (
    <DashboardShell profile={actor.profile}>
      {children}
    </DashboardShell>
  );
}
