import "server-only";

import { cache } from "react";
import type { PermissionKey, RoleKey } from "@/lib/constants";
import type { UserProfile } from "@/lib/db-types";
import { hasDefaultPermission } from "@/lib/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActorContext = {
  userId: string;
  email: string | undefined;
  profile: UserProfile;
};

const getActorContextCached = cache(async (): Promise<ActorContext> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("User profile not found");
  }

  await supabase
    .from("user_profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", profile.id)
    .eq("company_id", profile.company_id);

  return {
    userId: user.id,
    email: user.email,
    profile: profile as UserProfile
  };
});

export async function getActorContext(): Promise<ActorContext> {
  return getActorContextCached();
}

export function requireCompanyAdmin(actor: ActorContext): void {
  if (actor.profile.role_key !== "company_admin") {
    throw new Error("Forbidden");
  }
}

const getRolePermissionsCached = cache(async (roleKey: RoleKey) => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_key", roleKey);

  if (error) {
    return null;
  }

  return new Set((data ?? []).map((item) => item.permission_key as PermissionKey));
});

export async function hasPermission(
  roleKey: RoleKey,
  permissionKey: PermissionKey
): Promise<boolean> {
  if (roleKey === "company_admin") {
    return true;
  }

  const permissionSet = await getRolePermissionsCached(roleKey);
  if (!permissionSet) {
    return hasDefaultPermission(roleKey, permissionKey);
  }

  if (permissionSet.has(permissionKey)) {
    return true;
  }

  // Fallback keeps app usable when DB role_permissions is not fully seeded yet.
  return hasDefaultPermission(roleKey, permissionKey);
}

export async function requirePermission(
  actor: ActorContext,
  permissionKey: PermissionKey
): Promise<void> {
  if (actor.profile.status !== "active") {
    throw new Error("Inactive user");
  }

  const allowed = await hasPermission(actor.profile.role_key, permissionKey);
  if (!allowed) {
    throw new Error("Forbidden");
  }
}
