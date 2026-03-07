export const ROLE_KEYS = [
  "company_admin",
  "manager",
  "telecaller",
  "sales_executive"
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

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
