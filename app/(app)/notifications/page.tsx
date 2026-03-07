import { NotificationsList } from "@/components/notifications-list";
import type { Notification } from "@/lib/db-types";
import { getActorContext, hasPermission, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const actor = await getActorContext();
  await requirePermission(actor, "notifications.read");
  const canManage = await hasPermission(actor.profile.role_key, "notifications.manage");

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("notifications")
    .select(
      "id, notification_type, event_type, entity_type, entity_id, action_url, title, message, payload_json, is_read, created_at"
    )
    .eq("company_id", actor.profile.company_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!canManage) {
    query = query.eq("user_profile_id", actor.profile.id);
  }

  const { data: notifications } = await query;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-500">
          In-app alerts for assignments, follow-up deadlines, imports, and workflow updates.
        </p>
      </div>
      <NotificationsList
        initialNotifications={(notifications ?? []) as Notification[]}
      />
    </div>
  );
}
