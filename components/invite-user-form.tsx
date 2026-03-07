"use client";

import { useState } from "react";
import type { RoleKey } from "@/lib/constants";

type InviteUserFormProps = {
  onCreated: () => void;
};

const ROLE_OPTIONS: RoleKey[] = ["manager", "sales_executive", "view_only"];

export function InviteUserForm({ onCreated }: InviteUserFormProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleKey, setRoleKey] = useState<RoleKey>("sales_executive");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/users/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fullName, email, phone, roleKey })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to send invite");
      setLoading(false);
      return;
    }

    setSuccess("Invite sent");
    setFullName("");
    setEmail("");
    setPhone("");
    setRoleKey("sales_executive");
    setLoading(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Invite Team Member</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <input
          placeholder="Full name"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          placeholder="Phone (optional)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
          value={roleKey}
          onChange={(event) => setRoleKey(event.target.value as RoleKey)}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={loading}
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send invite"}
        </button>
        {error ? <span className="text-xs font-semibold text-red-600">{error}</span> : null}
        {success ? <span className="text-xs font-semibold text-emerald-600">{success}</span> : null}
      </div>
    </form>
  );
}
