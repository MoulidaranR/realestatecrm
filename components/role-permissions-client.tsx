"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

type PermEntry = { permission_key: string; description: string };

type RoleInfo = {
  role_key: string;
  role_name: string;
  is_system: boolean;
  is_protected: boolean;
  scope: string;
  description: string;
};

type RolePermissionsClientProps = {
  role: RoleInfo;
  allPermissions: PermEntry[];
  grantedKeys: string[];
  userCount: number;
  allRoles: Array<{ role_key: string; role_name: string }>;
};

const MODULE_GROUPS: Array<{ label: string; icon: string; prefix: string }> = [
  { label: "Dashboard", icon: "📊", prefix: "dashboard." },
  { label: "Leads", icon: "👥", prefix: "leads." },
  { label: "Follow-ups", icon: "📞", prefix: "followups." },
  { label: "Site Visits", icon: "🏠", prefix: "site_visits." },
  { label: "Reports", icon: "📈", prefix: "reports." },
  { label: "Imports", icon: "📥", prefix: "import." },
  { label: "Notifications", icon: "🔔", prefix: "notifications." },
  { label: "Users", icon: "👤", prefix: "users." },
  { label: "Roles", icon: "🛡", prefix: "roles." },
  { label: "Settings", icon: "⚙️", prefix: "settings." },
  { label: "Activity Logs", icon: "📋", prefix: "activity_logs." }
];

function permLabel(key: string): string {
  const part = key.split(".").slice(1).join(".");
  return part.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RolePermissionsClient({
  role,
  allPermissions,
  grantedKeys: initialGranted,
  userCount,
  allRoles
}: RolePermissionsClientProps) {
  const [granted, setGranted] = useState<Set<string>>(new Set(initialGranted));
  const [scope, setScope] = useState(role.scope ?? "company");
  const [copyLoading, setCopyLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const isAdmin = role.role_key === "company_admin";
  const isProtected = role.is_protected;
  const totalGranted = isAdmin ? allPermissions.length : granted.size;

  function toggle(key: string) {
    if (isAdmin) return;
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleModule(perms: PermEntry[], allGranted: boolean) {
    if (isAdmin) return;
    const keys = perms.map((p) => p.permission_key);
    setGranted((prev) => {
      const next = new Set(prev);
      if (allGranted) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  }

  function grantAll() {
    if (isAdmin) return;
    setGranted(new Set(allPermissions.map((p) => p.permission_key)));
  }

  function clearAll() {
    if (isAdmin) return;
    setGranted(new Set());
  }

  async function copyFromRole(sourceKey: string) {
    if (!sourceKey || isAdmin) return;
    setCopyLoading(true);
    const res = await fetch(`/api/roles/${sourceKey}/permissions`);
    const json = (await res.json()) as { grantedKeys?: string[]; error?: string };
    if (!res.ok || !json.grantedKeys) {
      toast("error", json.error ?? "Failed to load source role permissions.");
    } else {
      setGranted(new Set(json.grantedKeys));
      toast("success", "Permissions copied. Review and save to apply.");
    }
    setCopyLoading(false);
  }

  async function save() {
    startTransition(async () => {
      const res = await fetch(`/api/roles/${role.role_key}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKeys: Array.from(granted), scope })
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        toast("error", json.error ?? "Permission update failed. Please retry.");
        return;
      }
      toast("success", `Permissions updated for ${role.role_name}.`);
      router.refresh();
    });
  }

  const inputCls = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 transition-colors";

  return (
    <div className="space-y-5">
      {/* Role header info */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-text-primary">{role.role_name}</h2>
              <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">{role.role_key}</code>
              {role.is_system && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">System</span>}
              {isProtected && <span className="rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-semibold text-danger-700">🔒 Protected</span>}
            </div>
            {role.description && <p className="text-sm text-text-secondary">{role.description}</p>}
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span><strong className="text-text-primary">{userCount}</strong> active user{userCount !== 1 ? "s" : ""}</span>
              <span><strong className="text-text-primary">{totalGranted}</strong> of {allPermissions.length} permissions granted</span>
            </div>
          </div>
          {/* Scope selector */}
          {!isProtected && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Data Scope</label>
              <select
                className={inputCls}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                disabled={isAdmin}
              >
                <option value="own">Own records only</option>
                <option value="team">Team records</option>
                <option value="company">All company records</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Warnings */}
      {isAdmin && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
          <p className="text-xs font-medium text-primary-800">
            Company Admin has unrestricted access to all modules. Permissions cannot be restricted.
          </p>
        </div>
      )}

      {!isAdmin && userCount > 0 && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-xs text-warning-800">
          ⚠ <strong>{userCount}</strong> active user{userCount !== 1 ? "s are" : " is"} using this role. Changes will apply to all of them immediately after saving.
        </div>
      )}

      {/* Toolbar: Copy from role + Grant all / Clear all */}
      {!isAdmin && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
          <span className="text-xs font-semibold text-text-muted">Quick Actions:</span>
          <div className="flex items-center gap-2">
            <select
              className={`${inputCls} text-xs`}
              defaultValue=""
              onChange={(e) => { if (e.target.value) copyFromRole(e.target.value); e.target.value = ""; }}
              disabled={copyLoading}
            >
              <option value="">Copy permissions from…</option>
              {allRoles.filter((r) => r.role_key !== role.role_key).map((r) => (
                <option key={r.role_key} value={r.role_key}>{r.role_name}</option>
              ))}
            </select>
            {copyLoading && <svg className="h-4 w-4 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={grantAll} className="text-xs font-semibold text-success-700 hover:underline">Grant All</button>
            <span className="text-slate-300">|</span>
            <button type="button" onClick={clearAll} className="text-xs font-semibold text-danger-700 hover:underline">Clear All</button>
          </div>
        </div>
      )}

      {/* Permission modules */}
      {MODULE_GROUPS.map(({ label, icon, prefix }) => {
        const perms = allPermissions.filter((p) => p.permission_key.startsWith(prefix));
        if (perms.length === 0) return null;
        const allGranted = perms.every((p) => isAdmin || granted.has(p.permission_key));
        const grantedCount = isAdmin ? perms.length : perms.filter((p) => granted.has(p.permission_key)).length;

        return (
          <div key={prefix} className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
              <span className="text-base">{icon}</span>
              <h3 className="flex-1 text-sm font-semibold text-text-primary">{label}</h3>
              <span className="text-xs text-text-muted">{grantedCount}/{perms.length}</span>
              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => toggleModule(perms, allGranted)}
                  className={`text-xs font-semibold transition-colors ${allGranted ? "text-danger-600 hover:text-danger-700" : "text-success-700 hover:text-success-800"}`}
                >
                  {allGranted ? "Remove all" : "Grant all"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-4 divide-x divide-y divide-slate-100">
              {perms.map((p) => {
                const checked = isAdmin || granted.has(p.permission_key);
                return (
                  <label
                    key={p.permission_key}
                    className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${isAdmin ? "cursor-default" : "hover:bg-slate-50"} ${checked && !isAdmin ? "bg-primary-50/30" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.permission_key)}
                      disabled={isAdmin}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:cursor-default"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">{permLabel(p.permission_key)}</p>
                      <p className="text-[10px] text-text-muted truncate">{p.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Save button */}
      {!isAdmin && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={save} loading={pending}>
            Save Permissions
          </Button>
        </div>
      )}
    </div>
  );
}
