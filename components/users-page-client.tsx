"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoleKey } from "@/lib/constants";
import type { UserProfile } from "@/lib/db-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

const ROLE_OPTIONS: RoleKey[] = ["company_admin", "manager", "sales_executive", "view_only"];
const STATUS_OPTIONS: Array<UserProfile["status"]> = ["active", "disabled", "invited"];

function fmt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function roleVariant(role: RoleKey): "purple" | "info" | "warning" | "success" | "default" {
  if (role === "company_admin") return "purple";
  if (role === "manager") return "info";
  if (role === "sales_executive") return "warning";
  if (role === "view_only") return "default";
  return "success";
}

function statusVariant(s: UserProfile["status"]): "success" | "danger" | "warning" {
  if (s === "active") return "success";
  if (s === "disabled") return "danger";
  return "warning";
}

function roleLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

// ─── Add User Form (Inside Modal) ─────────────────────────────────────────
function AddUserForm({
  users,
  onCreated,
  onClose
}: {
  users: UserProfile[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState<RoleKey>("sales_executive");
  const [managerUserId, setManagerUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const managerOptions = useMemo(
    () =>
      users
        .filter((u) => u.status === "active" && (u.role_key === "company_admin" || u.role_key === "manager"))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, phone: phone || undefined, password, roleKey, managerUserId: managerUserId || null })
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to create user.");
      setLoading(false);
      return;
    }
    toast("success", `User ${fullName} created successfully.`);
    onCreated();
  }

  const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors";
  const labelCls = "mb-1 block text-xs font-semibold text-slate-600";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Full Name *</label>
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Ravi Kumar" />
        </div>
        <div>
          <label className={labelCls}>Email *</label>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ravi@company.com" />
        </div>
        <div>
          <label className={labelCls}>Password *</label>
          <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Min. 8 characters" />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
        </div>
        <div>
          <label className={labelCls}>Role *</label>
          <select className={inputCls} value={roleKey} onChange={(e) => setRoleKey(e.target.value as RoleKey)}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Reporting Manager</label>
          <select className={inputCls} value={managerUserId} onChange={(e) => setManagerUserId(e.target.value)}>
            <option value="">None</option>
            {managerOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name} ({roleLabel(m.role_key)})</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-600/20 bg-danger-50 px-4 py-2.5 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" loading={loading}>Create User</Button>
      </div>
    </form>
  );
}

// ─── Main Page Client ──────────────────────────────────────────────────────
export function UsersPageClient({ users: initialUsers }: { users: UserProfile[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [loadingId, setLoadingId] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | RoleKey>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserProfile["status"]>("all");

  const userNameMap = useMemo(() => new Map(initialUsers.map((u) => [u.id, u.full_name])), [initialUsers]);
  const managerOptions = useMemo(
    () => initialUsers.filter((u) => u.status === "active" && (u.role_key === "company_admin" || u.role_key === "manager")).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [initialUsers]
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...initialUsers]
      .filter((u) => {
        if (q && !`${u.full_name} ${u.email} ${u.phone ?? ""}`.toLowerCase().includes(q)) return false;
        if (roleFilter !== "all" && u.role_key !== roleFilter) return false;
        if (statusFilter !== "all" && u.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [initialUsers, query, roleFilter, statusFilter]);

  function isLastActiveAdmin(user: UserProfile): boolean {
    if (user.role_key !== "company_admin" || user.status !== "active") return false;
    return initialUsers.filter((u) => u.role_key === "company_admin" && u.status === "active").length <= 1;
  }

  async function patchUser(userId: string, endpoint: "" | "role" | "status" | "manager", body: Record<string, unknown>) {
    setLoadingId(userId);
    const path = endpoint ? `/api/users/${userId}/${endpoint}` : `/api/users/${userId}`;
    const res = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json()) as { error?: string };
    setLoadingId("");
    if (!res.ok) { toast("error", json.error ?? "Update failed."); return; }
    toast("success", "User updated.");
    router.refresh();
  }

  const selectCls = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              placeholder="Search users…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)} className={selectCls}>
            <option value="all">All roles</option>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={selectCls}>
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowAddModal(true)}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
        >
          Add User
        </Button>
      </div>

      {/* Stats */}
      <p className="text-xs text-text-muted">
        Showing <strong className="text-text-primary">{filteredUsers.length}</strong> of {initialUsers.length} users
      </p>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="table-container scrollbar-thin">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {["User", "Role", "Status", "Manager", "Created", "Last Active", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState compact title="No users found" description="Try adjusting your search or filters." />
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const lockAdmin = isLastActiveAdmin(user);
                  const editableRole: RoleKey = user.role_key === "telecaller" ? "sales_executive" : user.role_key;
                  const isBusy = loadingId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-[11px] font-bold text-primary-700">
                            {getInitials(user.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary truncate">{user.full_name}</p>
                            <p className="text-[11px] text-text-muted truncate">{user.email}</p>
                            {user.phone && <p className="text-[11px] text-text-muted">{user.phone}</p>}
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          <Badge variant={roleVariant(user.role_key)}>{roleLabel(editableRole)}</Badge>
                          <select
                            value={editableRole}
                            onChange={(e) => patchUser(user.id, "role", { roleKey: e.target.value })}
                            disabled={isBusy || lockAdmin}
                            className="block w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                          </select>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          <Badge variant={statusVariant(user.status)} dot>{user.status}</Badge>
                          <select
                            value={user.status}
                            onChange={(e) => patchUser(user.id, "status", { status: e.target.value })}
                            disabled={isBusy || lockAdmin}
                            className="block w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </td>
                      {/* Manager */}
                      <td className="px-4 py-3">
                        <select
                          value={user.manager_user_id ?? ""}
                          onChange={(e) => patchUser(user.id, "manager", { managerUserId: e.target.value || null })}
                          disabled={isBusy || user.role_key === "company_admin"}
                          className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Unassigned</option>
                          {managerOptions.filter((m) => m.id !== user.id).map((m) => (
                            <option key={m.id} value={m.id}>{m.full_name}</option>
                          ))}
                        </select>
                        {user.manager_user_id && (
                          <p className="mt-1 text-[10px] text-text-muted">{userNameMap.get(user.manager_user_id) ?? "Assigned"}</p>
                        )}
                      </td>
                      {/* Dates */}
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">{fmt(user.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">{fmt(user.last_active_at)}</td>
                      {/* Loading indicator */}
                      <td className="px-4 py-3">
                        {isBusy && (
                          <svg className="h-4 w-4 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        )}
                        {lockAdmin && (
                          <span title="Cannot modify the last admin" className="text-xs text-text-muted">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add New User" description="Create a user account. They can sign in immediately with these credentials." size="md">
        <AddUserForm
          users={initialUsers}
          onCreated={() => { setShowAddModal(false); router.refresh(); }}
          onClose={() => setShowAddModal(false)}
        />
      </Modal>
    </div>
  );
}
