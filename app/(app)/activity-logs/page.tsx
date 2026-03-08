import Link from "next/link";
import type { UserProfile } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type ActivityLogsPageProps = {
  searchParams: Promise<{
    actor?: string;
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
};

function fmt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function entityLink(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  if (entityType === "lead") return `/leads/${entityId}`;
  if (entityType === "follow_up") return "/follow-ups";
  if (entityType === "site_visit") return "/site-visits";
  if (entityType === "user") return "/users";
  if (entityType === "report") return "/reports";
  return null;
}

function entityVariant(t: string): "purple" | "info" | "warning" | "success" | "danger" | "default" {
  if (t === "lead") return "purple";
  if (t === "follow_up") return "info";
  if (t === "site_visit") return "success";
  if (t === "user") return "warning";
  return "default";
}

export default async function ActivityLogsPage({ searchParams }: ActivityLogsPageProps) {
  const actor = await getActorContext();
  await requirePermission(actor, "activity_logs.view");
  const params = await searchParams;
  const pageSize = 50;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const from = params.from?.trim() || "";
  const to = params.to?.trim() || "";
  const selectedActor = params.actor?.trim() || "";
  const selectedAction = params.action?.trim() || "";
  const selectedEntity = params.entity?.trim() || "";

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("activity_logs")
    .select("id, actor_user_id, action, entity_type, entity_id, description, before_json, after_json, created_at", { count: "exact" })
    .eq("company_id", actor.profile.company_id)
    .order("created_at", { ascending: false });

  if (selectedActor) query = query.eq("actor_user_id", selectedActor);
  if (selectedAction) query = query.ilike("action", `%${selectedAction}%`);
  if (selectedEntity) query = query.eq("entity_type", selectedEntity);
  if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);

  const fromRow = (page - 1) * pageSize;
  const { data: logs, count } = await query.range(fromRow, fromRow + pageSize - 1);

  const { data: usersData } = await supabase
    .from("user_profiles")
    .select("id, full_name")
    .eq("company_id", actor.profile.company_id)
    .order("full_name", { ascending: true })
    .limit(200);
  const users = (usersData ?? []) as Array<Pick<UserProfile, "id" | "full_name">>;
  const userMap = new Map(users.map((u) => [u.id, u.full_name]));

  const ENTITY_TYPES = ["lead", "follow_up", "site_visit", "user", "deal", "import", "report"];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));

  const selectCls = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500";

  function buildQs(overrides: Record<string, string | number>) {
    const base: Record<string, string> = { actor: selectedActor, action: selectedAction, entity: selectedEntity, from, to, page: String(page) };
    for (const [k, v] of Object.entries(overrides)) base[k] = String(v);
    return "?" + Object.entries(base).map(([k, v]) => v ? `${k}=${encodeURIComponent(v)}` : "").filter(Boolean).join("&");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Activity Logs"
        subtitle="Auditable timeline of lead, follow-up, site visit, user, and export events."
        breadcrumbs={[{ label: "System" }, { label: "Activity Logs" }]}
      />

      {/* Filter bar */}
      <form className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-wrap gap-2">
          <select name="actor" defaultValue={selectedActor} className={selectCls}>
            <option value="">All actors</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <input name="action" defaultValue={selectedAction} placeholder="Action keyword…" className={selectCls + " min-w-[140px]"} />
          <select name="entity" defaultValue={selectedEntity} className={selectCls}>
            <option value="">All entities</option>
            {ENTITY_TYPES.map((e) => <option key={e} value={e}>{e.replace(/_/g, " ")}</option>)}
          </select>
          <input type="date" name="from" defaultValue={from} className={selectCls} />
          <input type="date" name="to" defaultValue={to} className={selectCls} />
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 shadow-sm transition-colors">
            Apply
          </button>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Showing <strong className="text-text-primary">{(logs ?? []).length}</strong> of {count ?? 0} logs — Page {page}/{totalPages}
        </p>
      </form>

      {/* Timeline list */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        {(logs ?? []).length === 0 ? (
          <EmptyState title="No activity logs" description="Once your team starts working, events will appear here." />
        ) : (
          <div className="divide-y divide-slate-100">
            {(logs ?? []).map((log) => {
              const path = entityLink(log.entity_type, log.entity_id);
              const hasDiff = Object.keys(log.before_json ?? {}).length > 0 || Object.keys(log.after_json ?? {}).length > 0;
              return (
                <div key={log.id} className="flex gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className="mt-0.5 flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-primary-400 ring-4 ring-primary-50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        {log.actor_user_id ? userMap.get(log.actor_user_id) ?? "Unknown" : "System"}
                      </span>
                      <span className="text-xs text-text-muted">·</span>
                      <span className="text-xs font-mono text-text-secondary">{log.action}</span>
                      <Badge variant={entityVariant(log.entity_type)}>{log.entity_type.replace(/_/g, " ")}</Badge>
                      {path && (
                        <Link href={path} className="text-[11px] font-semibold text-primary-600 hover:underline">
                          Open →
                        </Link>
                      )}
                    </div>
                    {log.description && (
                      <p className="mt-1 text-sm text-text-secondary">{log.description}</p>
                    )}
                    {hasDiff && (
                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[11px] font-medium text-primary-600 hover:underline">View changes</summary>
                        <pre className="mt-1 rounded-lg bg-slate-50 p-2 text-[11px] text-text-muted overflow-x-auto max-h-48">
                          {JSON.stringify({ before: log.before_json, after: log.after_json }, null, 2)}
                        </pre>
                      </details>
                    )}
                    <p className="mt-1 text-[11px] text-text-disabled">{fmt(log.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 shadow-card text-sm">
          <p className="text-text-secondary">
            Page <strong>{page}</strong> / {totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              href={buildQs({ page: Math.max(1, page - 1) })}
              className={`rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              ← Previous
            </Link>
            <Link
              href={buildQs({ page: Math.min(totalPages, page + 1) })}
              className={`rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
            >
              Next →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
