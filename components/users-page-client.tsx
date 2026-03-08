"use client";

import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserProfile } from "@/lib/db-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type RoleOption = {
  role_key: string;
  role_name: string;
  is_system: boolean;
  is_protected: boolean;
  description: string;
  scope: string;
};

type PermissionEntry = { permission_key: string; description: string };
type PermOverrides = Record<string, boolean>;

type UserPermissionData = {
  userId: string;
  roleKey: string;
  accessMode: "role_only" | "custom_override";
  roleGranted: string[];
  overrides: PermOverrides;
  allPermissions: PermissionEntry[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function roleVariant(role: string): "purple" | "info" | "warning" | "success" | "default" {
  if (role === "company_admin") return "purple";
  if (role === "manager") return "info";
  if (role === "sales_executive") return "warning";
  if (role === "telecaller") return "success";
  return "default";
}

function statusVariant(s: UserProfile["status"]): "success" | "danger" | "warning" {
  if (s === "active") return "success";
  if (s === "disabled") return "danger";
  return "warning";
}

function roleLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const MODULE_GROUPS = [
  { label: "Dashboard", prefix: "dashboard." },
  { label: "Leads", prefix: "leads." },
  { label: "Follow-ups", prefix: "followups." },
  { label: "Site Visits", prefix: "site_visits." },
  { label: "Reports", prefix: "reports." },
  { label: "Imports", prefix: "import." },
  { label: "Notifications", prefix: "notifications." },
  { label: "Users", prefix: "users." },
  { label: "Roles", prefix: "roles." },
  { label: "Settings", prefix: "settings." },
  { label: "Activity Logs", prefix: "activity_logs." }
];

function permLabel(key: string): string {
  const part = key.split(".").slice(1).join(".");
  return part.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Input classes ────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors";
const labelCls = "mb-1 block text-xs font-semibold text-slate-600";

// ─── Row Action Menu ──────────────────────────────────────────────────────────
function ActionMenu({
  user,
  isLocked,
  onEditProfile,
  onEditPermissions,
  onSuspend,
  onActivate,
  onChangeRole,
  onChangeManager
}: {
  user: UserProfile;
  isLocked: boolean;
  onEditProfile: () => void;
  onEditPermissions: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onChangeRole: () => void;
  onChangeManager: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      key={label}
      type="button"
      onClick={() => { onClick(); setOpen(false); }}
      className={`w-full px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-slate-50 ${danger ? "text-danger-700" : "text-slate-700"}`}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-border p-1.5 hover:bg-slate-100 transition-colors"
        title="Actions"
      >
        <svg className="h-4 w-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-border bg-white shadow-lg py-1 divide-y divide-slate-100">
          <div>
            {item("Edit Profile", onEditProfile)}
            {item("Change Role", onChangeRole)}
            {item("Change Manager", onChangeManager)}
            {item("Edit Permissions", onEditPermissions)}
          </div>
          <div>
            {!isLocked && user.status === "active" && item("Suspend User", onSuspend, true)}
            {user.status === "disabled" && item("Re-activate User", onActivate)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add / Invite User Modal ──────────────────────────────────────────────────
function AddUserModal({
  users,
  roles,
  onCreated,
  onClose
}: {
  users: UserProfile[];
  roles: RoleOption[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"create" | "invite">("create");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  // Create form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState(roles.find((r) => r.role_key === "sales_executive")?.role_key ?? roles[0]?.role_key ?? "");
  const [managerUserId, setManagerUserId] = useState("");

  const managerOptions = useMemo(
    () => users.filter((u) => u.status === "active" && (u.role_key === "company_admin" || u.role_key === "manager")).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users]
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, phone: phone || undefined, password, roleKey, managerUserId: managerUserId || null })
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) { setError(json.error ?? "Failed to create user."); setLoading(false); return; }
    toast("success", `${fullName} has been added to the team.`);
    onCreated();
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, roleKey, managerUserId: managerUserId || null })
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) { setError(json.error ?? "Failed to send invite."); setLoading(false); return; }
    toast("success", `Invite sent to ${email}.`);
    onCreated();
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-border bg-slate-50 p-1">
        {(["create", "invite"] as const).map((t) => (
          <button key={t} type="button" onClick={() => { setTab(t); setError(""); }}
            className={`flex-1 rounded-md py-2 text-xs font-semibold capitalize transition-colors ${tab === t ? "bg-white shadow-sm text-text-primary" : "text-text-muted hover:text-text-secondary"}`}>
            {t === "create" ? "🔑 Create with Password" : "📧 Invite by Email"}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>Full Name *</label><input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Ravi Kumar" /></div>
            <div><label className={labelCls}>Email *</label><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ravi@company.com" /></div>
            <div><label className={labelCls}>Password *</label><input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Min. 8 characters" /></div>
            <div><label className={labelCls}>Phone</label><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" /></div>
            <div>
              <label className={labelCls}>Role *</label>
              <select className={inputCls} value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
                {roles.map((r) => <option key={r.role_key} value={r.role_key}>{r.role_name}{r.is_system ? "" : " (Custom)"}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Reporting Manager</label>
              <select className={inputCls} value={managerUserId} onChange={(e) => setManagerUserId(e.target.value)}>
                <option value="">None</option>
                {managerOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name} ({roleLabel(m.role_key)})</option>)}
              </select>
            </div>
          </div>
          {error && <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>Create User</Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={labelCls}>Email *</label><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="colleague@company.com" /></div>
            <div>
              <label className={labelCls}>Role *</label>
              <select className={inputCls} value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
                {roles.map((r) => <option key={r.role_key} value={r.role_key}>{r.role_name}{r.is_system ? "" : " (Custom)"}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Reporting Manager</label>
              <select className={inputCls} value={managerUserId} onChange={(e) => setManagerUserId(e.target.value)}>
                <option value="">None</option>
                {managerOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-text-muted">An invite email will be sent. The user can set their own password when they accept.</p>
          {error && <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>Send Invite</Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
function EditProfileModal({
  user,
  roles,
  users,
  onSaved,
  onClose
}: {
  user: UserProfile;
  roles: RoleOption[];
  users: UserProfile[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [roleKey, setRoleKey] = useState(user.role_key);
  const [managerUserId, setManagerUserId] = useState(user.manager_user_id ?? "");
  const [status, setStatus] = useState(user.status);
  const { toast } = useToast();
  const router = useRouter();

  const managerOptions = useMemo(
    () => users.filter((u) => u.id !== user.id && u.status === "active" && (u.role_key === "company_admin" || u.role_key === "manager")).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users, user.id]
  );

  async function patch(endpoint: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/users/${user.id}/${endpoint}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Update failed.");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await patch("", { fullName, phone: phone || null });
      if (roleKey !== user.role_key) await patch("role", { roleKey });
      if (managerUserId !== (user.manager_user_id ?? "")) await patch("manager", { managerUserId: managerUserId || null });
      if (status !== user.status) await patch("status", { status });
      toast("success", "User profile updated.");
      router.refresh();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className={labelCls}>Full Name *</label><input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
        <div><label className={labelCls}>Phone</label><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div>
          <label className={labelCls}>Role *</label>
          <select className={inputCls} value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
            {roles.map((r) => <option key={r.role_key} value={r.role_key}>{r.role_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as UserProfile["status"])}>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="invited">Invited</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Reporting Manager</label>
          <select className={inputCls} value={managerUserId} onChange={(e) => setManagerUserId(e.target.value)}>
            <option value="">None</option>
            {managerOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name} ({roleLabel(m.role_key)})</option>)}
          </select>
        </div>
      </div>
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</div>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" loading={loading}>Save Changes</Button>
      </div>
    </form>
  );
}

// ─── User Permission Override Drawer ─────────────────────────────────────────
function PermissionDrawer({
  user,
  onClose
}: {
  user: UserProfile;
  onClose: () => void;
}) {
  const [data, setData] = useState<UserPermissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessMode, setAccessMode] = useState<"role_only" | "custom_override">("role_only");
  const [overrides, setOverrides] = useState<PermOverrides>({});
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/users/${user.id}/permissions`)
      .then((r) => r.json())
      .then((d: UserPermissionData) => {
        setData(d);
        setAccessMode(d.accessMode);
        setOverrides(d.overrides);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user.id]);

  function toggleOverride(key: string) {
    if (accessMode !== "custom_override") return;
    setOverrides((prev) => {
      const next = { ...prev };
      if (key in next) {
        // Toggle allowed value
        next[key] = !next[key];
      } else {
        // Grant override
        next[key] = true;
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/users/${user.id}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessMode, overrides: accessMode === "custom_override" ? overrides : {} })
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      toast("error", json.error ?? "Permission update failed. Please retry.");
    } else {
      toast("success", "Permissions updated successfully.");
      router.refresh();
    }
    setSaving(false);
  }

  const isAdmin = user.role_key === "company_admin";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{user.full_name}</h2>
            <p className="text-xs text-text-muted">Permission Editor</p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-border p-1.5 hover:bg-slate-100 transition-colors">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-text-muted text-sm">Loading permissions…</div>
          ) : (
            <>
              {isAdmin && (
                <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 text-xs text-primary-800">
                  Company Admin has unrestricted access to all modules.
                </div>
              )}

              {/* Access mode toggle */}
              {!isAdmin && (
                <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
                  <p className="text-xs font-semibold text-text-primary">Access Mode</p>
                  <div className="flex gap-2">
                    {(["role_only", "custom_override"] as const).map((mode) => (
                      <button key={mode} type="button"
                        onClick={() => setAccessMode(mode)}
                        className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${accessMode === mode ? "bg-primary-600 text-white" : "border border-slate-300 text-text-secondary hover:bg-slate-50"}`}>
                        {mode === "role_only" ? "Use Role Permissions" : "Custom Override"}
                      </button>
                    ))}
                  </div>
                  {accessMode === "custom_override" && (
                    <p className="text-[11px] text-warning-700 bg-warning-50 rounded-lg px-3 py-2 border border-warning-200">
                      ⚠ Custom overrides are applied on top of the role&apos;s permissions. Changes take effect immediately after saving.
                    </p>
                  )}
                </div>
              )}

              {/* Permission matrix */}
              {!isAdmin && data && (
                <div className="space-y-3">
                  {MODULE_GROUPS.map(({ label, prefix }) => {
                    const perms = data.allPermissions.filter((p) => p.permission_key.startsWith(prefix));
                    if (perms.length === 0) return null;
                    return (
                      <div key={prefix} className="rounded-xl border border-border overflow-hidden">
                        <div className="bg-slate-50/70 px-4 py-2 border-b border-slate-100">
                          <span className="text-xs font-semibold text-text-primary">{label}</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {perms.map((p) => {
                            const fromRole = data.roleGranted.includes(p.permission_key);
                            const override = overrides[p.permission_key];
                            const effective = accessMode === "custom_override"
                              ? (override !== undefined ? override : fromRole)
                              : fromRole;
                            const hasOverride = accessMode === "custom_override" && override !== undefined;

                            return (
                              <label key={p.permission_key}
                                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${accessMode === "custom_override" ? "hover:bg-slate-50" : "cursor-default"}`}>
                                <input
                                  type="checkbox"
                                  checked={effective}
                                  onChange={() => toggleOverride(p.permission_key)}
                                  disabled={accessMode !== "custom_override"}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-60"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-text-primary">{permLabel(p.permission_key)}</p>
                                  {hasOverride && (
                                    <span className="text-[10px] text-primary-600 font-semibold">
                                      {override ? "Granted by override" : "Denied by override"}
                                    </span>
                                  )}
                                  {!hasOverride && fromRole && accessMode === "custom_override" && (
                                    <span className="text-[10px] text-text-disabled">From role</span>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isAdmin && (
          <div className="border-t border-slate-100 px-5 py-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>Save Permissions</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Users Page Client ────────────────────────────────────────────────────
export function UsersPageClient({
  users: initialUsers,
  roles,
  currentUserId
}: {
  users: UserProfile[];
  roles: RoleOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [permUser, setPermUser] = useState<UserProfile | null>(null);
  const [loadingId, setLoadingId] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserProfile["status"]>("all");
  const [managerFilter, setManagerFilter] = useState("all");

  const userNameMap = useMemo(() => new Map(users.map((u) => [u.id, u.full_name])), [users]);
  const managerOptions = useMemo(
    () => users.filter((u) => u.role_key === "company_admin" || u.role_key === "manager").sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users]
  );

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    invited: users.filter((u) => u.status === "invited").length,
    disabled: users.filter((u) => u.status === "disabled").length
  }), [users]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...users]
      .filter((u) => {
        if (q && !`${u.full_name} ${u.email} ${u.phone ?? ""}`.toLowerCase().includes(q)) return false;
        if (roleFilter !== "all" && u.role_key !== roleFilter) return false;
        if (statusFilter !== "all" && u.status !== statusFilter) return false;
        if (managerFilter !== "all" && u.manager_user_id !== managerFilter) return false;
        return true;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [users, query, roleFilter, statusFilter, managerFilter]);

  function isLastActiveAdmin(user: UserProfile): boolean {
    if (user.role_key !== "company_admin" || user.status !== "active") return false;
    return users.filter((u) => u.role_key === "company_admin" && u.status === "active").length <= 1;
  }

  const patchUser = useCallback(async (userId: string, endpoint: string, body: Record<string, unknown>) => {
    setLoadingId(userId);
    const path = endpoint ? `/api/users/${userId}/${endpoint}` : `/api/users/${userId}`;
    const res = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json()) as { error?: string };
    setLoadingId("");
    if (!res.ok) { toast("error", json.error ?? "Update failed."); return false; }
    router.refresh();
    return true;
  }, [router, toast]);

  const selectCls = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500";

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", count: stats.total, color: "text-text-primary" },
          { label: "Active", count: stats.active, color: "text-success-700" },
          { label: "Invited", count: stats.invited, color: "text-warning-700" },
          { label: "Disabled", count: stats.disabled, color: "text-danger-700" }
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface px-4 py-3 text-center shadow-card">
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input placeholder="Search users…" value={query} onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectCls}>
            <option value="all">All roles</option>
            {roles.map((r) => <option key={r.role_key} value={r.role_key}>{r.role_name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={selectCls}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="disabled">Disabled</option>
          </select>
          <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} className={selectCls}>
            <option value="all">All managers</option>
            {managerOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowAddModal(true)}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}>
          Add User
        </Button>
      </div>

      <p className="text-xs text-text-muted px-1">
        Showing <strong className="text-text-primary">{filteredUsers.length}</strong> of {users.length} users
      </p>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="table-container scrollbar-thin">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {["User", "Role", "Status", "Manager", "Access", "Created", "Last Active", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={8}><EmptyState compact title="No users found" description="Try adjusting your search or filters." /></td></tr>
              ) : (
                filteredUsers.map((user) => {
                  const locked = isLastActiveAdmin(user) || user.id === currentUserId;
                  const isBusy = loadingId === user.id;
                  const roleInfo = roles.find((r) => r.role_key === user.role_key);
                  const accessMode = (user as UserProfile & { access_mode?: string }).access_mode;

                  return (
                    <tr key={user.id} className={`hover:bg-slate-50/60 transition-colors ${isBusy ? "opacity-60" : ""}`}>
                      {/* User cell */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-[11px] font-bold text-primary-700">
                            {getInitials(user.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary truncate max-w-[140px]">{user.full_name}</p>
                            <p className="text-[11px] text-text-muted truncate">{user.email}</p>
                            {user.phone && <p className="text-[11px] text-text-muted">{user.phone}</p>}
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <Badge variant={roleVariant(user.role_key)}>{roleInfo?.role_name ?? roleLabel(user.role_key)}</Badge>
                          {!roleInfo?.is_system && <span className="text-[10px] text-text-disabled">Custom</span>}
                          {locked && user.role_key === "company_admin" && (
                            <div><span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">Protected</span></div>
                          )}
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3"><Badge variant={statusVariant(user.status)} dot>{user.status}</Badge></td>
                      {/* Manager */}
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {user.manager_user_id ? userNameMap.get(user.manager_user_id) ?? "—" : <span className="text-text-disabled">Unassigned</span>}
                      </td>
                      {/* Access mode */}
                      <td className="px-4 py-3">
                        {accessMode === "custom_override" ? (
                          <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-semibold text-warning-700">Custom Override</span>
                        ) : (
                          <span className="text-[10px] text-text-disabled">Role-based</span>
                        )}
                      </td>
                      {/* Dates */}
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">{fmt(user.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                        {fmt((user as UserProfile & { last_active_at?: string }).last_active_at ?? null)}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <ActionMenu
                          user={user}
                          isLocked={locked}
                          onEditProfile={() => setEditUser(user)}
                          onEditPermissions={() => setPermUser(user)}
                          onChangeRole={() => setEditUser(user)}
                          onChangeManager={() => setEditUser(user)}
                          onSuspend={() => patchUser(user.id, "status", { status: "disabled" }).then((ok) => { if (ok) { toast("success", `${user.full_name} has been suspended.`); setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: "disabled" } : u)); } })}
                          onActivate={() => patchUser(user.id, "status", { status: "active" }).then((ok) => { if (ok) { toast("success", `${user.full_name} re-activated.`); setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: "active" } : u)); } })}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add New User" size="md"
        description="Create an account immediately or send an email invite.">
        <AddUserModal
          users={users}
          roles={roles.filter((r) => r.role_key !== "company_admin")}
          onCreated={() => { setShowAddModal(false); router.refresh(); }}
          onClose={() => setShowAddModal(false)}
        />
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User" size="md"
        description="Update profile, role, manager, and account status.">
        {editUser && (
          <EditProfileModal
            user={editUser}
            roles={roles}
            users={users}
            onSaved={() => setEditUser(null)}
            onClose={() => setEditUser(null)}
          />
        )}
      </Modal>

      {permUser && <PermissionDrawer user={permUser} onClose={() => setPermUser(null)} />}
    </div>
  );
}
