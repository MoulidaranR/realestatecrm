import type { SupabaseClient } from "@supabase/supabase-js";

type LogActivityInput = {
  companyId: string;
  actorUserId: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
};

export async function logActivity(
  admin: SupabaseClient,
  input: LogActivityInput
): Promise<void> {
  await admin.from("activity_logs").insert({
    company_id: input.companyId,
    actor_user_id: input.actorUserId,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    description: input.description,
    metadata_json: input.metadata ?? {}
  });
}
