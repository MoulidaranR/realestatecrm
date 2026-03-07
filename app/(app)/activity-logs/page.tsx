import Link from "next/link";
import type { UserProfile } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "-";
  }
  return date.toLocaleString();
}

function relatedEntityPath(entityType: string, entityId: string | null): string | null {
  if (!entityId) {
    return null;
  }
  if (entityType === "lead") {
    return `/leads/${entityId}`;
  }
  if (entityType === "follow_up") {
    return "/follow-ups";
  }
  if (entityType === "site_visit") {
    return "/site-visits";
  }
  if (entityType === "user") {
    return "/users";
  }
  if (entityType === "report") {
    return "/reports";
  }
  return null;
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
    .select(
      "id, actor_user_id, action, entity_type, entity_id, description, before_json, after_json, created_at",
      { count: "exact" }
    )
    .eq("company_id", actor.profile.company_id)
    .order("created_at", { ascending: false });

  if (selectedActor) {
    query = query.eq("actor_user_id", selectedActor);
  }
  if (selectedAction) {
    query = query.ilike("action", `%${selectedAction}%`);
  }
  if (selectedEntity) {
    query = query.eq("entity_type", selectedEntity);
  }
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00.000Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59.999Z`);
  }
  const fromRow = (page - 1) * pageSize;
  const toRow = fromRow + pageSize - 1;
  const { data: logs, count } = await query.range(fromRow, toRow);

  const usersQuery = await supabase
    .from("user_profiles")
    .select("id, full_name")
    .eq("company_id", actor.profile.company_id)
    .order("full_name", { ascending: true })
    .limit(200);
  const users = (usersQuery.data ?? []) as Array<Pick<UserProfile, "id" | "full_name">>;
  const userMap = new Map(users.map((user) => [user.id, user.full_name]));

  const entityTypes = Array.from(new Set((logs ?? []).map((log) => log.entity_type))).sort();
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Activity Logs</h1>
        <p className="text-sm text-slate-500">
          Auditable timeline of lead, follow-up, site visit, user, and export events.
        </p>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Actor
            <select
              name="actor"
              defaultValue={selectedActor}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">All actors</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Action
            <input
              name="action"
              defaultValue={selectedAction}
              placeholder="lead.created"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Entity
            <select
              name="entity"
              defaultValue={selectedEntity}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">All entities</option>
              {entityTypes.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            From
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            To
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="flex items-end gap-2">
            <input type="hidden" name="page" value="1" />
            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
            >
              Apply
            </button>
          </div>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Changes</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log) => {
              const path = relatedEntityPath(log.entity_type, log.entity_id);
              return (
                <tr key={log.id} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(log.created_at)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {log.actor_user_id ? userMap.get(log.actor_user_id) ?? "Unknown user" : "System"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{log.action}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {log.entity_type}
                    {log.entity_id ? ` (${log.entity_id})` : ""}
                    {path ? (
                      <div>
                        <Link href={path} className="text-xs font-semibold text-primary hover:underline">
                          Open
                        </Link>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{log.description}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <p>Before: {Object.keys(log.before_json ?? {}).length ? JSON.stringify(log.before_json) : "-"}</p>
                    <p className="mt-1">After: {Object.keys(log.after_json ?? {}).length ? JSON.stringify(log.after_json) : "-"}</p>
                  </td>
                </tr>
              );
            })}
            {(logs ?? []).length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={6}>
                  No activity logs found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-600">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Link
            href={`?actor=${encodeURIComponent(selectedActor)}&action=${encodeURIComponent(
              selectedAction
            )}&entity=${encodeURIComponent(selectedEntity)}&from=${encodeURIComponent(
              from
            )}&to=${encodeURIComponent(to)}&page=${Math.max(1, page - 1)}`}
            className={`rounded-lg border border-slate-300 px-3 py-1.5 ${
              page <= 1 ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Previous
          </Link>
          <Link
            href={`?actor=${encodeURIComponent(selectedActor)}&action=${encodeURIComponent(
              selectedAction
            )}&entity=${encodeURIComponent(selectedEntity)}&from=${encodeURIComponent(
              from
            )}&to=${encodeURIComponent(to)}&page=${Math.min(totalPages, page + 1)}`}
            className={`rounded-lg border border-slate-300 px-3 py-1.5 ${
              page >= totalPages ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
