"use client";

import { useMemo, useState } from "react";
import type { RoleKey } from "@/lib/constants";
import type { UserProfile } from "@/lib/db-types";

type UsersTableProps = {
  initialUsers: UserProfile[];
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

function normalizePhone(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function UsersTable({ initialUsers }: UsersTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [baseline, setBaseline] = useState(
    Object.fromEntries(
      initialUsers.map((user) => [
        user.id,
        {
          full_name: user.full_name,
          phone: normalizePhone(user.phone)
        }
      ])
    ) as Record<string, { full_name: string; phone: string | null }>
  );
  const [loadingId, setLoadingId] = useState<string>("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users]
  );
  const userNameMap = useMemo(() => new Map(users.map((user) => [user.id, user.full_name])), [users]);
  const managerOptions = useMemo(
    () =>
      [...users]
        .filter(
          (user) =>
            user.status === "active" &&
            (user.role_key === "company_admin" || user.role_key === "manager")
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users]
  );

  async function patchUser(
    userId: string,
    endpoint: "" | "role" | "status" | "manager",
    body: Record<string, unknown>,
    onSuccess: () => void
  ) {
    setLoadingId(userId);
    setError("");
    setSuccess("");
    const path = endpoint ? `/api/users/${userId}/${endpoint}` : `/api/users/${userId}`;
    const response = await fetch(path, {
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
    setSuccess("User updated.");
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

  function hasProfileChanges(user: UserProfile): boolean {
    const original = baseline[user.id];
    if (!original) {
      return true;
    }
    return (
      original.full_name !== user.full_name ||
      normalizePhone(original.phone) !== normalizePhone(user.phone)
    );
  }

  function saveUserProfile(user: UserProfile) {
    patchUser(
      user.id,
      "",
      {
        fullName: user.full_name,
        phone: normalizePhone(user.phone)
      },
      () =>
        setBaseline((prev) => ({
          ...prev,
          [user.id]: {
            full_name: user.full_name,
            phone: normalizePhone(user.phone)
          }
        }))
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {success ? <p className="text-sm font-semibold text-emerald-600">{success}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1300px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Invited</th>
              <th className="px-4 py-3">Last Active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => {
              const lockAdmin = isLastActiveCompanyAdmin(user);
              const pendingProfileSave = hasProfileChanges(user);
              const editableRole: RoleKey =
                user.role_key === "telecaller" ? "sales_executive" : user.role_key;
              return (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      value={user.full_name}
                      onChange={(event) =>
                        setUsers((prev) =>
                          prev.map((item) =>
                            item.id === user.id ? { ...item, full_name: event.target.value } : item
                          )
                        )
                      }
                      disabled={loadingId === user.id}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <input
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      value={user.phone ?? ""}
                      placeholder="Phone"
                      onChange={(event) =>
                        setUsers((prev) =>
                          prev.map((item) =>
                            item.id === user.id
                              ? { ...item, phone: event.target.value || null }
                              : item
                          )
                        )
                      }
                      disabled={loadingId === user.id}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${roleBadge(user.role_key)}`}
                      >
                        {editableRole}
                      </span>
                      <select
                        value={editableRole}
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
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(user.invited_at)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(user.last_active_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => saveUserProfile(user)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={loadingId === user.id || !pendingProfileSave}
                    >
                      {loadingId === user.id ? "Saving..." : "Save Details"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {sortedUsers.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={10}>
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
