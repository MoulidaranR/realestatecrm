import type { ActivityLog, UserProfile } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "-";
  }
  return date.toLocaleString();
}

export default async function ActivityLogsPage() {
  const actor = await getActorContext();
  await requirePermission(actor, "activity_logs.view");

  const supabase = await createServerSupabaseClient();
  const { data: logs } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("company_id", actor.profile.company_id)
    .order("created_at", { ascending: false })
    .limit(300);

  const actorIds = Array.from(
    new Set((logs ?? []).map((log) => log.actor_user_id).filter(Boolean))
  );
  const { data: users } = actorIds.length
    ? await supabase.from("user_profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as Array<Pick<UserProfile, "id" | "full_name">> };
  const userMap = new Map((users ?? []).map((user) => [user.id, user.full_name]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Activity logs</h1>
        <p className="text-sm text-slate-500">
          Audit trail for user actions, imports, stage changes, and operational events.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {((logs ?? []) as ActivityLog[]).map((log) => (
              <tr key={log.id} className="border-b border-slate-100">
                <td className="px-4 py-3 text-slate-700">{formatDateTime(log.created_at)}</td>
                <td className="px-4 py-3 text-slate-700">
                  {log.actor_user_id ? userMap.get(log.actor_user_id) ?? "Unknown user" : "System"}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{log.action}</td>
                <td className="px-4 py-3 text-slate-700">
                  {log.entity_type}
                  {log.entity_id ? ` (${log.entity_id})` : ""}
                </td>
                <td className="px-4 py-3 text-slate-700">{log.description}</td>
              </tr>
            ))}
            {(logs ?? []).length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                  No activity logs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
