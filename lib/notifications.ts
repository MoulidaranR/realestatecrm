import type { SupabaseClient } from "@supabase/supabase-js";

type NotificationInput = {
  companyId: string;
  userProfileId: string;
  eventType: string;
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
    event_type: input.eventType,
    title: input.title,
    message: input.message,
    channel: input.channel ?? "in_app",
    payload_json: input.payload ?? {}
  });
}
