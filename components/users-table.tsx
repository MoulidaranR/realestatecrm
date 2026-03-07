"use client";

import { useMemo, useState } from "react";
import type { RoleKey } from "@/lib/constants";
import type { UserProfile } from "@/lib/db-types";

type UsersTableProps = {
  initialUsers: UserProfile[];
  managerOptions: Array<Pick<UserProfile, "id" | "full_name" | "role_key">>;
};

const ROLE_OPTIONS: RoleKey[] = [
  "company_admin",
  "manager",
  "sales_executive",
  "view_only"
];

const STATUS_OPTIONS: Array<UserProfile["status"]> = ["active", "disabled", "invited"];

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "-";
  }
  return date.toLocaleString();
}

function roleBadge(role: RoleKey): string {
  if (role === "company_admin") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (role === "manager") {
    return "bg-blue-100 text-blue-700";
  }
  if (role === "view_only") {
    return "bg-slate-100 text-slate-700";
  }
  return "bg-amber-100 text-amber-700";
}

function statusBadge(status: UserProfile["status"]): string {
  if (status === "active") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "disabled") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-amber-100 text-amber-700";
}

export function UsersTable({ initialUsers, managerOptions }: UsersTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [loadingId, setLoadingId] = useState<string>("");
  const [error, setError] = useState("");

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users]
  );
  const userNameMap = useMemo(() => new Map(users.map((user) => [user.id, user.full_name])), [users]);

  async function patchUser(
    userId: string,
    endpoint: "role" | "status" | "manager",
    body: Record<string, unknown>,
    onSuccess: () => void
  ) {
    setLoadingId(userId);
    setError("");
    const response = await fetch(`/api/users/${userId}/${endpoint}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to update user");
      setLoadingId("");
      return;
    }
    onSuccess();
    setLoadingId("");
  }

  function isLastActiveCompanyAdmin(user: UserProfile): boolean {
    if (user.role_key !== "company_admin" || user.status !== "active") {
      return false;
    }
    const activeAdmins = users.filter(
      (item) => item.role_key === "company_admin" && item.status === "active"
    );
    return activeAdmins.length <= 1;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1100px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => {
              const lockAdmin = isLastActiveCompanyAdmin(user);
              return (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{user.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">{user.phone ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${roleBadge(user.role_key)}`}
                      >
                        {user.role_key}
                      </span>
                      <select
                        value={user.role_key}
                        onChange={(event) =>
                          patchUser(
                            user.id,
                            "role",
                            { roleKey: event.target.value as RoleKey },
                            () =>
                              setUsers((prev) =>
                                prev.map((item) =>
                                  item.id === user.id
                                    ? { ...item, role_key: event.target.value as RoleKey }
                                    : item
                                )
                              )
                          )
                        }
                        className="block w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        disabled={loadingId === user.id || lockAdmin}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${statusBadge(user.status)}`}
                      >
                        {user.status}
                      </span>
                      <select
                        value={user.status}
                        onChange={(event) =>
                          patchUser(
                            user.id,
                            "status",
                            { status: event.target.value as UserProfile["status"] },
                            () =>
                              setUsers((prev) =>
                                prev.map((item) =>
                                  item.id === user.id
                                    ? { ...item, status: event.target.value as UserProfile["status"] }
                                    : item
                                )
                              )
                          )
                        }
                        className="block w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        disabled={loadingId === user.id || lockAdmin}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.manager_user_id ?? ""}
                      onChange={(event) =>
                        patchUser(
                          user.id,
                          "manager",
                          { managerUserId: event.target.value || null },
                          () =>
                            setUsers((prev) =>
                              prev.map((item) =>
                                item.id === user.id
                                  ? { ...item, manager_user_id: event.target.value || null }
                                  : item
                              )
                            )
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      disabled={loadingId === user.id || user.role_key === "company_admin"}
                    >
                      <option value="">Unassigned</option>
                      {managerOptions
                        .filter((manager) => manager.id !== user.id)
                        .map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.full_name} ({manager.role_key})
                          </option>
                        ))}
                    </select>
                    {user.manager_user_id ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {userNameMap.get(user.manager_user_id) ?? "Assigned"}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(user.created_at)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(user.last_active_at)}</td>
                </tr>
              );
            })}
            {sortedUsers.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                  No users found in this workspace.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
