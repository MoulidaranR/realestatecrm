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

function isCompanyAdminRole(roleKey: string): boolean {
  return roleKey.toLowerCase() === "company_admin";
}

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
  if (!isCompanyAdminRole(actor.profile.role_key)) {
    throw new Error("Forbidden");
  }
}

// ─── Role-level permissions (cached per role key) ─────────────────────────
const getRolePermissionsCached = cache(async (roleKey: RoleKey) => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_key", roleKey);

  if (error) return null;
  return new Set((data ?? []).map((item) => item.permission_key as PermissionKey));
});

// ─── Per-user overrides (cached per user profile id) ─────────────────────
const getUserOverridesCached = cache(async (userProfileId: string) => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_permission_overrides")
    .select("permission_key, allowed")
    .eq("user_profile_id", userProfileId);

  if (error) return null;
  return (data ?? []) as Array<{ permission_key: string; allowed: boolean }>;
});

// ─── Core permission check ─────────────────────────────────────────────────
/**
 * Resolves the effective permission for a user.
 *
 * Resolution order:
 * 1. Company admin → always true
 * 2. If access_mode = "custom_override" → apply override table on top of role
 *    - override.allowed=true grants even if role denies
 *    - override.allowed=false denies even if role grants
 * 3. Role-level DB permissions (with fallback to DEFAULT_ROLE_PERMISSIONS)
 */
export async function hasPermission(
  roleKeyOrProfile: RoleKey | UserProfile,
  permissionKey: PermissionKey
): Promise<boolean> {
  // Support both legacy (roleKey string) and new (UserProfile) call signatures
  const profile = typeof roleKeyOrProfile === "string" ? null : roleKeyOrProfile;
  const roleKey: string = profile ? profile.role_key : (roleKeyOrProfile as string);

  if (isCompanyAdminRole(roleKey)) return true;

  // Check per-user overrides if user profile provided and access_mode = custom_override
  if (profile && (profile as UserProfile & { access_mode?: string }).access_mode === "custom_override") {
    const overrides = await getUserOverridesCached(profile.id);
    if (overrides) {
      const override = overrides.find((o) => o.permission_key === permissionKey);
      if (override) return override.allowed;
    }
  }

  // Role-level DB check
  const permissionSet = await getRolePermissionsCached(roleKey);
  if (permissionSet) {
    return permissionSet.has(permissionKey);
  }

  // Fallback to hardcoded defaults (keeps app working if DB not seeded)
  return hasDefaultPermission(roleKey, permissionKey);
}

// ─── Get all effective permissions for a user ─────────────────────────────
export async function getEffectivePermissions(profile: UserProfile): Promise<Set<PermissionKey>> {
  if (isCompanyAdminRole(profile.role_key)) {
    const { PERMISSION_KEYS } = await import("@/lib/constants");
    return new Set(PERMISSION_KEYS as unknown as PermissionKey[]);
  }

  // Start with role permissions
  const rolePerms = await getRolePermissionsCached(profile.role_key);
  const effective = new Set<PermissionKey>(rolePerms ?? []);

  // Apply user overrides if custom_override mode
  if ((profile as UserProfile & { access_mode?: string }).access_mode === "custom_override") {
    const overrides = await getUserOverridesCached(profile.id);
    for (const o of overrides ?? []) {
      if (o.allowed) {
        effective.add(o.permission_key as PermissionKey);
      } else {
        effective.delete(o.permission_key as PermissionKey);
      }
    }
  }

  return effective;
}

// ─── Require permission (throws on failure) ────────────────────────────────
export async function requirePermission(
  actor: ActorContext,
  permissionKey: PermissionKey
): Promise<void> {
  if (actor.profile.status !== "active") {
    throw new Error("Inactive user");
  }

  const allowed = await hasPermission(actor.profile, permissionKey);
  if (!allowed) {
    throw new Error("Forbidden");
  }
}
