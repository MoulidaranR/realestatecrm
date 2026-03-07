import type { PermissionKey, RoleKey } from "@/lib/constants";

type RolePermissionMap = Record<RoleKey, PermissionKey[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMap = {
  company_admin: [
    "dashboard.view",
    "users.read",
    "users.invite",
    "users.update_role",
    "users.update_status",
    "users.update_manager",
    "leads.read",
    "leads.create",
    "leads.update",
    "leads.assign",
    "followups.read",
    "followups.manage",
    "site_visits.read",
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
    "leads.read",
    "leads.create",
    "leads.update",
    "leads.assign",
    "followups.read",
    "followups.manage",
    "site_visits.read",
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
    "leads.update",
    "followups.read",
    "site_visits.read",
    "site_visits.manage",
    "reports.view",
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
  ],
  telecaller: [
    "dashboard.view",
    "leads.read",
    "leads.update",
    "followups.read",
    "site_visits.read",
    "site_visits.manage",
    "reports.view",
    "notifications.read"
  ]
};

export function hasDefaultPermission(role: RoleKey, permission: PermissionKey): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role].includes(permission);
}
