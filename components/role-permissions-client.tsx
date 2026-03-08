"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";


type PermEntry = { permission_key: string; description: string };

type RolePermissionsClientProps = {
  roleKey: string;
  roleName: string;
  allPermissions: PermEntry[];
  grantedKeys: string[];
};

const MODULE_GROUPS: Array<{ label: string; prefix: string }> = [
  { label: "Dashboard", prefix: "dashboard." },
  { label: "Leads", prefix: "leads." },
  { label: "Follow-ups", prefix: "followups." },
  { label: "Site Visits", prefix: "site_visits." },
  { label: "Reports", prefix: "reports." },
  { label: "Imports", prefix: "import." },
  { label: "Notifications", prefix: "notifications." },
  { label: "Users", prefix: "users." },
  { label: "Activity Logs", prefix: "activity_logs." }
];

function permLabel(key: string): string {
  const part = key.split(".")[1] ?? key;
  return part
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RolePermissionsClient({
  roleKey,
  roleName,
  allPermissions,
  grantedKeys: initialGranted
}: RolePermissionsClientProps) {
  const [granted, setGranted] = useState<Set<string>>(new Set(initialGranted));
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const isAdmin = roleKey === "company_admin";

  function toggle(key: string) {
    if (isAdmin) return; // company_admin always has everything
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    startTransition(async () => {
      const res = await fetch(`/api/roles/${roleKey}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKeys: Array.from(granted) })
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        toast("error", json.error ?? "Failed to save permissions.");
        return;
      }
      toast("success", `Permissions updated for ${roleName}.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {isAdmin && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
          <p className="text-xs font-medium text-primary-800">
            Company Admin has unrestricted access to all modules. Permissions cannot be restricted.
          </p>
        </div>
      )}

      {MODULE_GROUPS.map(({ label, prefix }) => {
        const perms = allPermissions.filter((p) => p.permission_key.startsWith(prefix));
        if (perms.length === 0) return null;
        const allGranted = perms.every((p) => isAdmin || granted.has(p.permission_key));
        return (
          <div key={prefix} className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
              <h3 className="flex-1 text-sm font-semibold text-text-primary">{label}</h3>
              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const keys = perms.map((p) => p.permission_key);
                    setGranted((prev) => {
                      const next = new Set(prev);
                      if (allGranted) keys.forEach((k) => next.delete(k));
                      else keys.forEach((k) => next.add(k));
                      return next;
                    });
                  }}
                  className="text-xs font-medium text-primary-600 hover:underline"
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
                    className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                      isAdmin ? "cursor-default" : "hover:bg-slate-50"
                    }`}
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

      {!isAdmin && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 shadow-sm transition-colors"
          >
            {pending ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            {pending ? "Saving…" : "Save Permissions"}
          </button>
        </div>
      )}
    </div>
  );
}
