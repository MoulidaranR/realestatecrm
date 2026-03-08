import Link from "next/link";
import { redirect } from "next/navigation";
import { getActorContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const ROLE_COLORS: Record<string, "purple" | "info" | "warning" | "success" | "default"> = {
  company_admin: "purple",
  manager: "info",
  sales_executive: "warning",
  view_only: "default",
  telecaller: "success"
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  company_admin: "Full access to all modules, users, settings, and reports.",
  manager: "Team oversight — leads, follow-ups, site visits, reports.",
  sales_executive: "Individual contributor — manage own leads and site visits.",
  telecaller: "Call-focused — create and manage own leads and follow-ups.",
  view_only: "Read access to assigned modules only."
};

export default async function RolesPage() {
  const actor = await getActorContext();
  if (actor.profile.role_key !== "company_admin") {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const { data: roles } = await supabase
    .from("roles")
    .select("role_key, role_name, created_at")
    .order("created_at", { ascending: true });

  // Count users per role
  const { data: userCounts } = await supabase
    .from("user_profiles")
    .select("role_key")
    .eq("company_id", actor.profile.company_id)
    .eq("status", "active");

  const countMap = new Map<string, number>();
  for (const u of userCounts ?? []) {
    countMap.set(u.role_key, (countMap.get(u.role_key) ?? 0) + 1);
  }

  // Count permissions per role
  const { data: permCounts } = await supabase
    .from("role_permissions")
    .select("role_key");

  const permMap = new Map<string, number>();
  for (const p of permCounts ?? []) {
    permMap.set(p.role_key, (permMap.get(p.role_key) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define what each role can access and do in the CRM."
        breadcrumbs={[{ label: "Management" }, { label: "Roles & Permissions" }]}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-medium text-amber-800">
          <strong>Note:</strong> Roles define the default permissions for users. You can grant or restrict individual permissions per user from the Users page.
        </p>
      </div>

      {(roles ?? []).length === 0 ? (
        <div className="rounded-xl border border-border bg-surface shadow-card">
          <EmptyState title="No roles configured" description="Default roles will appear here after seeding." compact />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(roles ?? []).map((role) => {
            const userCount = countMap.get(role.role_key) ?? 0;
            const permCount = permMap.get(role.role_key) ?? 0;
            const variant = ROLE_COLORS[role.role_key] ?? "default";
            const desc = ROLE_DESCRIPTIONS[role.role_key] ?? "Custom role with configurable permissions.";
            return (
              <div key={role.role_key} className="rounded-xl border border-border bg-surface p-5 shadow-card hover:shadow-card-md transition-shadow">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Badge variant={variant}>{role.role_name}</Badge>
                    <p className="mt-2 text-xs text-text-muted leading-relaxed">{desc}</p>
                  </div>
                </div>
                <div className="mb-4 flex items-center gap-4 text-xs text-text-muted">
                  <span>
                    <strong className="text-text-primary">{userCount}</strong> active user{userCount !== 1 ? "s" : ""}
                  </span>
                  <span>
                    <strong className="text-text-primary">{permCount}</strong> permission{permCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <Link
                  href={`/roles/${role.role_key}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Permissions
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
