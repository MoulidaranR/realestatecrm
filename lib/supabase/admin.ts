import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function createAdminSupabaseClient() {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !serviceRoleKey ||
    serviceRoleKey === "PASTE_YOUR_SERVICE_ROLE_KEY" ||
    serviceRoleKey.startsWith("PASTE_")
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Set the service_role key from Supabase Settings > API."
    );
  }

  return createClient(env.SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
