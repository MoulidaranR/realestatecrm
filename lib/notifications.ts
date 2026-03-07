import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/lib/db-types";

type NotificationInput = {
  companyId: string;
  userProfileId: string;
  eventType: string;
  notificationType?: NotificationType;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  title: string;
  message: string;
  channel?: "in_app" | "email";
  payload?: Record<string, unknown>;
};

export async function createNotification(
  admin: SupabaseClient,
  input: NotificationInput
): Promise<void> {
  await admin.from("notifications").insert({
    company_id: input.companyId,
    user_profile_id: input.userProfileId,
    notification_type: input.notificationType ?? "system",
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    action_url: input.actionUrl ?? null,
    title: input.title,
    message: input.message,
    channel: input.channel ?? "in_app",
    payload_json: input.payload ?? {}
  });
}
