// System role keys that are seeded by migrations and always exist
export const SYSTEM_ROLE_KEYS = [
  "company_admin",
  "manager",
  "sales_executive",
  "telecaller",
  "view_only"
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

// RoleKey is now flexible to support custom roles created by company admins
export type RoleKey = string;

// Legacy: only used in hasDefaultPermission fallback — maps to system roles
export const ROLE_KEYS = SYSTEM_ROLE_KEYS;

// Roles that can be assigned to new users (system defaults)
export const DEFAULT_ASSIGNABLE_ROLES: SystemRoleKey[] = [
  "manager",
  "sales_executive",
  "telecaller",
  "view_only"
];

// Legacy alias used by some API routes (prefer DB validation now)
export const MANAGED_ROLE_KEYS = DEFAULT_ASSIGNABLE_ROLES;

export const PERMISSION_KEYS = [
  // Dashboard
  "dashboard.view",
  // Users
  "users.read",
  "users.invite",
  "users.manage",
  "users.update_role",
  "users.update_status",
  "users.update_manager",
  // Roles
  "roles.manage",
  // Settings
  "settings.manage",
  // Leads
  "leads.read",
  "leads.create",
  "leads.update",
  "leads.assign",
  "leads.delete",
  "leads.export",
  // Follow-ups
  "followups.read",
  "followups.create",
  "followups.manage",
  // Site Visits
  "site_visits.read",
  "site_visits.create",
  "site_visits.manage",
  // Reports
  "reports.view",
  "reports.export",
  // Imports
  "import.manage",
  // Notifications
  "notifications.read",
  "notifications.manage",
  // Activity Logs
  "activity_logs.view"
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
