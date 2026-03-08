"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

type RoleEntry = {
  role_key: string;
  role_name: string;
  description: string;
  scope: string;
  is_system: boolean;
  is_protected: boolean;
  company_id: string | null;
  updated_at: string;
  user_count: number;
  perm_count: number;
};

const ROLE_COLORS: Record<string, "purple" | "info" | "warning" | "success" | "default"> = {
  company_admin: "purple",
  manager: "info",
  sales_executive: "warning",
  view_only: "default",
  telecaller: "success"
};

const SCOPE_LABELS: Record<string, string> = {
  own: "Own records",
  team: "Team records",
  company: "All company records"
};

// ─── Create Role Modal ────────────────────────────────────────────────────────
function CreateRoleModal({
  existingRoles,
  onCreated,
  onClose
}: {
  existingRoles: RoleEntry[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const [roleName, setRoleName] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("company");
  const [copyFrom, setCopyFrom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors";
  const labelCls = "mb-1 block text-xs font-semibold text-slate-600";

  function handleNameChange(name: string) {
    setRoleName(name);
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    setRoleKey(slug);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleName, roleKey, description, scope, copyFromRoleKey: copyFrom || null })
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) { setError(json.error ?? "Failed to create role."); setLoading(false); return; }
    toast("success", `Role "${roleName}" created successfully.`);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Role Name *</label>
          <input className={inputCls} value={roleName} onChange={(e) => handleNameChange(e.target.value)} required placeholder="e.g. Auditor" />
        </div>
        <div>
          <label className={labelCls}>Role Key * <span className="text-text-disabled font-normal">(auto-slugged)</span></label>
          <input className={`${inputCls} font-mono`} value={roleKey} onChange={(e) => setRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} required placeholder="auditor" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Description</label>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is for…" />
        </div>
        <div>
          <label className={labelCls}>Scope</label>
          <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="own">Own — can only see own records</option>
            <option value="team">Team — can see their team&apos;s records</option>
            <option value="company">Company — can see all records</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Copy Permissions From</label>
          <select className={inputCls} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
            <option value="">Blank (no permissions)</option>
            {existingRoles.map((r) => (
              <option key={r.role_key} value={r.role_key}>{r.role_name}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</div>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" loading={loading}>Create Role</Button>
      </div>
    </form>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteRoleModal({
  role,
  onDeleted,
  onClose
}: {
  role: RoleEntry;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  async function handleDelete() {
    setLoading(true); setError("");
    const res = await fetch(`/api/roles/${role.role_key}`, { method: "DELETE" });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) { setError(json.error ?? "Failed to delete role."); setLoading(false); return; }
    toast("success", `Role "${role.role_name}" deleted.`);
    onDeleted();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
        <strong>Warning:</strong> Deleting &quot;<strong>{role.role_name}</strong>&quot; is permanent. Users assigned to this role must be reassigned first.
      </div>
      {role.user_count > 0 && (
        <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-2.5 text-xs text-warning-800">
          ⚠ <strong>{role.user_count}</strong> active user(s) are currently assigned this role. Reassign them before deleting.
        </div>
      )}
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{error}</div>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={handleDelete} loading={loading} disabled={role.user_count > 0}>
          Delete Role
        </Button>
      </div>
    </div>
  );
}

// ─── Main Roles Page Client ───────────────────────────────────────────────────
export function RolesPageClient({ roles: initialRoles }: { roles: RoleEntry[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteRole, setDeleteRole] = useState<RoleEntry | null>(null);

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-medium text-amber-800">
          <strong>Note:</strong> System roles can be edited but not deleted. Company Admin is fully protected. Custom roles can be deleted only when no users are assigned.
        </p>
      </div>

      {/* Header row with Create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          <strong className="text-text-primary">{initialRoles.filter((r) => !r.is_system).length}</strong> custom role(s) · <strong className="text-text-primary">{initialRoles.filter((r) => r.is_system).length}</strong> system roles
        </p>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}
          icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}>
          Create Role
        </Button>
      </div>

      {/* System Roles */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">System Roles</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {initialRoles.filter((r) => r.is_system).map((role) => (
            <RoleCard key={role.role_key} role={role} onDelete={() => setDeleteRole(role)} />
          ))}
        </div>
      </div>

      {/* Custom Roles */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Custom Roles</h3>
        {initialRoles.filter((r) => !r.is_system).length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white">
            <EmptyState
              compact
              title="No custom roles yet"
              description="Create a role like Auditor, Financier, or CRM Coordinator."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {initialRoles.filter((r) => !r.is_system).map((role) => (
              <RoleCard key={role.role_key} role={role} onDelete={() => setDeleteRole(role)} />
            ))}
          </div>
        )}
      </div>

      {/* Create Role Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Custom Role" description="Define a new role with specific permissions for your business." size="md">
        <CreateRoleModal
          existingRoles={initialRoles}
          onCreated={() => { setShowCreate(false); router.refresh(); }}
          onClose={() => setShowCreate(false)}
        />
      </Modal>

      {/* Delete Role Modal */}
      <Modal open={!!deleteRole} onClose={() => setDeleteRole(null)} title="Delete Role" size="sm">
        {deleteRole && (
          <DeleteRoleModal
            role={deleteRole}
            onDeleted={() => { setDeleteRole(null); router.refresh(); }}
            onClose={() => setDeleteRole(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// ─── Role Card ────────────────────────────────────────────────────────────────
function RoleCard({ role, onDelete }: { role: RoleEntry; onDelete: () => void }) {
  const variant = ROLE_COLORS[role.role_key] ?? "default";
  const scopeLabel = SCOPE_LABELS[role.scope] ?? role.scope;

  function fmtDate(v: string) {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.valueOf()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card hover:shadow-card-md transition-shadow flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={variant}>{role.role_name}</Badge>
            {role.is_system ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">System</span>
            ) : (
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">Custom</span>
            )}
            {role.is_protected && (
              <span className="rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-semibold text-danger-700" title="Cannot be deleted">🔒 Protected</span>
            )}
          </div>
          <p className="text-[11px] font-mono text-text-muted">{role.role_key}</p>
        </div>
      </div>

      {/* Description */}
      {role.description && (
        <p className="text-xs text-text-secondary leading-relaxed">{role.description}</p>
      )}

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted border-t border-slate-100 pt-3">
        <span><strong className="text-text-primary">{role.user_count}</strong> user{role.user_count !== 1 ? "s" : ""}</span>
        <span><strong className="text-text-primary">{role.perm_count}</strong> permission{role.perm_count !== 1 ? "s" : ""}</span>
        <span className="ml-auto text-[10px]">{scopeLabel}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
        <Link
          href={`/roles/${role.role_key}`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Permissions
        </Link>
        {!role.is_protected && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-danger-200 px-3 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-50 transition-colors"
            title="Delete this role"
          >
            Delete
          </button>
        )}
      </div>

      {/* Last updated */}
      <p className="text-[10px] text-text-disabled">Updated {fmtDate(role.updated_at)}</p>
    </div>
  );
}
