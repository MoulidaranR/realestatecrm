import type { PermissionKey, RoleKey, SystemRoleKey } from "@/lib/constants";

type SystemRolePermissionMap = Record<SystemRoleKey, PermissionKey[]>;

export const DEFAULT_ROLE_PERMISSIONS: SystemRolePermissionMap = {
  company_admin: [
    "dashboard.view",
    "users.read",
    "users.invite",
    "users.manage",
    "users.update_role",
    "users.update_status",
    "users.update_manager",
    "roles.manage",
    "settings.manage",
    "leads.read",
    "leads.create",
    "leads.update",
    "leads.assign",
    "leads.delete",
    "leads.export",
    "followups.read",
    "followups.create",
    "followups.manage",
    "site_visits.read",
    "site_visits.create",
    "site_visits.manage",
    "reports.view",
    "reports.export",
    "import.manage",
    "notifications.read",
    "notifications.manage",
    "activity_logs.view"
  ],
  manager: [
    "dashboard.view",
    "users.read",
    "users.update_manager",
    "leads.read",
    "leads.create",
    "leads.update",
    "leads.assign",
    "leads.export",
    "followups.read",
    "followups.create",
    "followups.manage",
    "site_visits.read",
    "site_visits.create",
    "site_visits.manage",
    "reports.view",
    "reports.export",
    "import.manage",
    "notifications.read",
    "notifications.manage",
    "activity_logs.view"
  ],
  sales_executive: [
    "dashboard.view",
    "leads.read",
    "leads.create",
    "leads.update",
    "followups.read",
    "followups.create",
    "site_visits.read",
    "site_visits.create",
    "site_visits.manage",
    "reports.view",
    "notifications.read"
  ],
  telecaller: [
    "dashboard.view",
    "leads.read",
    "leads.create",
    "leads.update",
    "followups.read",
    "followups.create",
    "followups.manage",
    "site_visits.read",
    "notifications.read"
  ],
  view_only: [
    "dashboard.view",
    "leads.read",
    "followups.read",
    "site_visits.read",
    "reports.view",
    "notifications.read",
    "activity_logs.view"
  ]
};

export function hasDefaultPermission(role: RoleKey, permission: PermissionKey): boolean {
  const perms = DEFAULT_ROLE_PERMISSIONS[role as SystemRoleKey];
  if (!perms) return false;
  return perms.includes(permission);
}
