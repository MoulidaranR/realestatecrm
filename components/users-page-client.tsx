"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoleKey } from "@/lib/constants";
import type { UserProfile } from "@/lib/db-types";

type UsersPageClientProps = {
  users: UserProfile[];
};

const ROLE_OPTIONS: RoleKey[] = [
  "company_admin",
  "manager",
  "sales_executive",
  "view_only"
];

const STATUS_OPTIONS: Array<UserProfile["status"]> = ["active", "disabled", "invited"];

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "-";
  return date.toLocaleString();
}

function roleBadge(role: RoleKey): string {
  if (role === "company_admin") return "bg-emerald-100 text-emerald-700";
  if (role === "manager") return "bg-blue-100 text-blue-700";
  if (role === "view_only") return "bg-slate-100 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function statusBadge(status: UserProfile["status"]): string {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "disabled") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

/* ──────────────────────── Add User Form ──────────────────────── */

function AddUserForm({
  users,
  onCreated,
  onCancel
}: {
  users: UserProfile[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState<RoleKey>("sales_executive");
  const [managerUserId, setManagerUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const managerOptions = useMemo(
    () =>
      users
        .filter(
          (u) =>
            u.status === "active" &&
            (u.role_key === "company_admin" || u.role_key === "manager")
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        phone: phone || undefined,
        password,
        roleKey,
        managerUserId: managerUserId || null
      })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to create user");
      setLoading(false);
      return;
    }

    setLoading(false);
    onCreated();
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-white p-6 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Add New User</h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Full Name *
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email *
            </label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="john@company.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Password *
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phone
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Role *
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value as RoleKey)}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reporting Manager
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
              value={managerUserId}
              onChange={(e) => setManagerUserId(e.target.value)}
            >
              <option value="">None</option>
              {managerOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.role_key.replace(/_/g, " ")})
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create User"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ──────────────────────── Main Page Client ──────────────────────── */

export function UsersPageClient({ users: initialUsers }: UsersPageClientProps) {
  const router = useRouter();
  const users = initialUsers;
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingId, setLoadingId] = useState("");
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(
    null
  );

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users]
  );
  const userNameMap = useMemo(
    () => new Map(users.map((u) => [u.id, u.full_name])),
    [users]
  );
  const managerOptions = useMemo(
    () =>
      users
        .filter(
          (u) =>
            u.status === "active" &&
            (u.role_key === "company_admin" || u.role_key === "manager")
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [users]
  );

  function isLastActiveAdmin(user: UserProfile): boolean {
    if (user.role_key !== "company_admin" || user.status !== "active") return false;
    return users.filter((u) => u.role_key === "company_admin" && u.status === "active").length <= 1;
  }

  async function patchUser(
    userId: string,
    endpoint: "" | "role" | "status" | "manager",
    body: Record<string, unknown>,
    onSuccess: (updatedUsers: UserProfile[]) => void
  ) {
    setLoadingId(userId);
    setFeedback(null);
    const path = endpoint ? `/api/users/${userId}/${endpoint}` : `/api/users/${userId}`;
    const response = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setFeedback({ type: "error", message: payload.error ?? "Update failed" });
      setLoadingId("");
      return;
    }
    onSuccess(users);
    setFeedback({ type: "success", message: "User updated." });
    setLoadingId("");
    router.refresh();
  }

  function handleAddUserCreated() {
    setShowAddForm(false);
    setFeedback({ type: "success", message: "User created successfully! They can now sign in." });
    router.refresh();
  }

  /* ──── Empty state ──── */
  if (users.length <= 1 && !showAddForm) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Add your first team member</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Start building your team. Create user accounts for your managers, sales executives, and
            other team members.
          </p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            + Add User
          </button>
        </div>

        {/* Still show existing users even in "empty" state (the admin themselves) */}
        {users.length > 0 ? (
          <UserTable
            users={sortedUsers}
            userNameMap={userNameMap}
            managerOptions={managerOptions}
            loadingId={loadingId}
            isLastActiveAdmin={isLastActiveAdmin}
            patchUser={patchUser}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-semibold ${
            feedback.type === "error"
              ? "bg-red-50 text-red-600"
              : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {showAddForm ? (
        <AddUserForm
          users={users}
          onCreated={handleAddUserCreated}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            + Add User
          </button>
        </div>
      )}

      <UserTable
        users={sortedUsers}
        userNameMap={userNameMap}
        managerOptions={managerOptions}
        loadingId={loadingId}
        isLastActiveAdmin={isLastActiveAdmin}
        patchUser={patchUser}
      />
    </div>
  );
}

/* ──────────────────────── Users Table Component ──────────────────────── */

function UserTable({
  users,
  userNameMap,
  managerOptions,
  loadingId,
  isLastActiveAdmin,
  patchUser
}: {
  users: UserProfile[];
  userNameMap: Map<string, string>;
  managerOptions: UserProfile[];
  loadingId: string;
  isLastActiveAdmin: (user: UserProfile) => boolean;
  patchUser: (
    userId: string,
    endpoint: "" | "role" | "status" | "manager",
    body: Record<string, unknown>,
    onSuccess: (updatedUsers: UserProfile[]) => void
  ) => void;
}) {

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[1200px] text-left text-sm">
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
          {users.map((user) => {
            const lockAdmin = isLastActiveAdmin(user);
            const editableRole: RoleKey =
              user.role_key === "telecaller" ? "sales_executive" : user.role_key;
            return (
              <tr key={user.id} className="border-b border-slate-100 align-top">
                <td className="px-4 py-3 font-medium text-slate-900">{user.full_name}</td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3 text-slate-600">{user.phone ?? "-"}</td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${roleBadge(user.role_key)}`}
                    >
                      {editableRole.replace(/_/g, " ")}
                    </span>
                    <select
                      value={editableRole}
                      onChange={(e) =>
                        patchUser(
                          user.id,
                          "role",
                          { roleKey: e.target.value as RoleKey },
                          () => {} // server re-renders via router.refresh
                        )
                      }
                      className="block w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      disabled={loadingId === user.id || lockAdmin}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role.replace(/_/g, " ")}
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
                      onChange={(e) =>
                        patchUser(
                          user.id,
                          "status",
                          { status: e.target.value as UserProfile["status"] },
                          () => {}
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
                    onChange={(e) =>
                      patchUser(
                        user.id,
                        "manager",
                        { managerUserId: e.target.value || null },
                        () => {}
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    disabled={loadingId === user.id || user.role_key === "company_admin"}
                  >
                    <option value="">Unassigned</option>
                    {managerOptions
                      .filter((m) => m.id !== user.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.role_key.replace(/_/g, " ")})
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
                <td className="px-4 py-3 text-slate-600">
                  {formatDateTime(user.last_active_at)}
                </td>
              </tr>
            );
          })}
          {users.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                No users found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
