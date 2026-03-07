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
  "telecaller",
  "sales_executive"
];

const STATUS_OPTIONS: Array<UserProfile["status"]> = ["active", "invited", "disabled"];

export function UsersTable({ initialUsers, managerOptions }: UsersTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [loadingId, setLoadingId] = useState<string>("");
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users]
  );

  async function updateRole(userId: string, roleKey: RoleKey) {
    setLoadingId(userId);
    const response = await fetch(`/api/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleKey })
    });

    if (response.ok) {
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, role_key: roleKey } : user))
      );
    }
    setLoadingId("");
  }

  async function updateStatus(userId: string, status: UserProfile["status"]) {
    setLoadingId(userId);
    const response = await fetch(`/api/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, status } : user))
      );
    }
    setLoadingId("");
  }

  async function updateManager(userId: string, managerUserId: string | null) {
    setLoadingId(userId);
    const response = await fetch(`/api/users/${userId}/manager`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerUserId })
    });

    if (response.ok) {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, manager_user_id: managerUserId } : user
        )
      );
    }
    setLoadingId("");
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Manager</th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((user) => (
            <tr key={user.id} className="border-b border-slate-100">
              <td className="px-4 py-3 font-medium text-slate-800">{user.full_name}</td>
              <td className="px-4 py-3 text-slate-600">{user.email}</td>
              <td className="px-4 py-3">
                <select
                  value={user.role_key}
                  onChange={(event) => updateRole(user.id, event.target.value as RoleKey)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  disabled={loadingId === user.id}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <select
                  value={user.status}
                  onChange={(event) =>
                    updateStatus(user.id, event.target.value as UserProfile["status"])
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  disabled={loadingId === user.id}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <select
                  value={user.manager_user_id ?? ""}
                  onChange={(event) =>
                    updateManager(user.id, event.target.value || null)
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
