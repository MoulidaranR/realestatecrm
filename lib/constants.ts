export const ROLE_KEYS = [
  "company_admin",
  "manager",
  "sales_executive",
  "view_only",
  // Legacy role kept for backward compatibility with older rows before migration.
  "telecaller"
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const MANAGED_ROLE_KEYS: RoleKey[] = [
  "company_admin",
  "manager",
  "sales_executive",
  "view_only"
];

export const PERMISSION_KEYS = [
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
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
