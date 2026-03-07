"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FollowUpMode, FollowUpPriority, FollowUpStatus, UserProfile } from "@/lib/db-types";
import { FOLLOW_UP_MODES, FOLLOW_UP_PRIORITIES, FOLLOW_UP_STATUSES } from "@/lib/lead-options";

export type FollowUpListItem = {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  lead_city: string;
  lead_source_platform: string;
  lead_priority: string;
  assigned_user_id: string;
  assignee_name: string;
  due_at: string;
  status: FollowUpStatus;
  mode: FollowUpMode;
  purpose: string | null;
  outcome: string | null;
  priority: FollowUpPriority;
  note: string | null;
  next_followup_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type FollowUpLeadOption = {
  id: string;
  full_name: string;
  phone: string;
  city: string | null;
  source_platform: string;
  lead_priority: string;
};

type FollowUpsTableProps = {
  initialFollowUps: FollowUpListItem[];
  leads: FollowUpLeadOption[];
  users: Array<Pick<UserProfile, "id" | "full_name" | "role_key" | "status">>;
  canManage: boolean;
};

type FollowUpFilter = "today" | "overdue" | "upcoming" | "completed" | "missed" | "all";

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

export function FollowUpsTable({ initialFollowUps, leads, users, canManage }: FollowUpsTableProps) {
  const [followUps, setFollowUps] = useState(initialFollowUps);
  const [activeFilter, setActiveFilter] = useState<FollowUpFilter>("today");
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [leadPriorityFilter, setLeadPriorityFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    leadId: leads[0]?.id ?? "",
    assignedUserId: users[0]?.id ?? "",
    dueAt: "",
    mode: "call" as FollowUpMode,
    purpose: "",
    outcome: "",
    priority: "medium" as FollowUpPriority,
    status: "pending" as FollowUpStatus,
    note: "",
    nextFollowupAt: ""
  });

  const cityOptions = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.city || "Unknown"))).sort(),
    [leads]
  );
  const assigneeOptions = useMemo(
    () => Array.from(new Set(followUps.map((item) => item.assignee_name))).sort(),
    [followUps]
  );

  const filteredFollowUps = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const normalizedSearch = search.trim().toLowerCase();
    return followUps.filter((item) => {
      const dueDate = new Date(item.due_at);
      const isToday = dueDate.toDateString() === today;
      const isOverdue = dueDate < now && item.status === "pending";
      const isUpcoming = dueDate > now && ["pending"].includes(item.status);
      const isCompleted = item.status === "completed";
      const isMissed = item.status === "missed";

      if (activeFilter === "today" && !isToday) {
        return false;
      }
      if (activeFilter === "overdue" && !isOverdue) {
        return false;
      }
      if (activeFilter === "upcoming" && !isUpcoming) {
        return false;
      }
      if (activeFilter === "completed" && !isCompleted) {
        return false;
      }
      if (activeFilter === "missed" && !isMissed) {
        return false;
      }

      if (
        normalizedSearch &&
        !`${item.lead_name} ${item.lead_phone} ${item.lead_city}`.toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }
      if (assigneeFilter !== "all" && item.assignee_name !== assigneeFilter) {
        return false;
      }
      if (priorityFilter !== "all" && item.priority !== priorityFilter) {
        return false;
      }
      if (modeFilter !== "all" && item.mode !== modeFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (cityFilter !== "all" && item.lead_city !== cityFilter) {
        return false;
      }
      if (sourceFilter !== "all" && item.lead_source_platform !== sourceFilter) {
        return false;
      }
      if (leadPriorityFilter !== "all" && item.lead_priority !== leadPriorityFilter) {
        return false;
      }
      if (fromDate) {
        const from = new Date(`${fromDate}T00:00:00`);
        if (dueDate < from) {
          return false;
        }
      }
      if (toDate) {
        const to = new Date(`${toDate}T23:59:59`);
        if (dueDate > to) {
          return false;
        }
      }
      return true;
    });
  }, [
    activeFilter,
    assigneeFilter,
    cityFilter,
    followUps,
    fromDate,
    leadPriorityFilter,
    modeFilter,
    priorityFilter,
    search,
    sourceFilter,
    statusFilter,
    toDate
  ]);

  async function createFollowUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoadingId("create");

    const response = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const payload = (await response.json()) as { error?: string; id?: string };
    if (!response.ok || !payload.id) {
      setError(payload.error ?? "Failed to create follow-up");
      setLoadingId("");
      return;
    }

    const createdId = payload.id;
    const lead = leads.find((item) => item.id === form.leadId);
    const user = users.find((item) => item.id === form.assignedUserId);
    setFollowUps((prev) => [
      {
        id: createdId,
        lead_id: form.leadId,
        lead_name: lead?.full_name ?? "Unknown lead",
        lead_phone: lead?.phone ?? "-",
        lead_city: lead?.city ?? "Unknown",
        lead_source_platform: lead?.source_platform ?? "unknown",
        lead_priority: lead?.lead_priority ?? "warm",
        assigned_user_id: form.assignedUserId,
        assignee_name: user?.full_name ?? "Unknown user",
        due_at: new Date(form.dueAt).toISOString(),
        status: form.status,
        mode: form.mode,
        purpose: form.purpose || null,
        outcome: form.outcome || null,
        priority: form.priority,
        note: form.note || null,
        next_followup_at: form.nextFollowupAt ? new Date(form.nextFollowupAt).toISOString() : null,
        completed_at: form.status === "completed" ? new Date().toISOString() : null,
        created_at: new Date().toISOString()
      },
      ...prev
    ]);
    setForm((prev) => ({
      ...prev,
      dueAt: "",
      purpose: "",
      outcome: "",
      note: "",
      nextFollowupAt: ""
    }));
    setSuccess("Follow-up created.");
    setLoadingId("");
  }

  async function updateStatus(
    item: FollowUpListItem,
    status: FollowUpStatus,
    nextFollowupAt: string | null = null
  ) {
    setLoadingId(item.id);
    setError("");
    setSuccess("");
    const response = await fetch(`/api/follow-ups/${item.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        nextFollowupAt,
        outcome: item.outcome,
        note: item.note
      })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to update follow-up");
      setLoadingId("");
      return;
    }
    setFollowUps((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              status,
              next_followup_at: nextFollowupAt ? new Date(nextFollowupAt).toISOString() : entry.next_followup_at,
              completed_at: status === "completed" ? new Date().toISOString() : entry.completed_at
            }
          : entry
      )
    );
    setSuccess("Follow-up updated.");
    setLoadingId("");
  }

  async function reschedule(item: FollowUpListItem) {
    const next = window.prompt("Enter new follow-up datetime (YYYY-MM-DDTHH:mm)", "");
    if (!next) {
      return;
    }
    await updateStatus(item, "pending", next);
  }

  return (
    <div className="space-y-3">
      {canManage ? (
        <form onSubmit={createFollowUp} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Create Follow-up</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              value={form.leadId}
              onChange={(event) => setForm((prev) => ({ ...prev, leadId: event.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            >
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.full_name} ({lead.phone})
                </option>
              ))}
            </select>
            <select
              value={form.assignedUserId}
              onChange={(event) => setForm((prev) => ({ ...prev, assignedUserId: event.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={form.dueAt}
              onChange={(event) => setForm((prev) => ({ ...prev, dueAt: event.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <select
              value={form.mode}
              onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value as FollowUpMode }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {FOLLOW_UP_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, priority: event.target.value as FollowUpPriority }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {FOLLOW_UP_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as FollowUpStatus }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {FOLLOW_UP_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              placeholder="Purpose"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.purpose}
              onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))}
            />
            <input
              placeholder="Outcome"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.outcome}
              onChange={(event) => setForm((prev) => ({ ...prev, outcome: event.target.value }))}
            />
            <input
              type="datetime-local"
              value={form.nextFollowupAt}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, nextFollowupAt: event.target.value }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <textarea
            rows={2}
            placeholder="Notes"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
          />
          <button
            type="submit"
            disabled={loadingId === "create"}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loadingId === "create" ? "Saving..." : "Create Follow-up"}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          You can view follow-ups but cannot create or modify them with your current role.
        </div>
      )}

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {success ? <p className="text-sm font-semibold text-emerald-600">{success}</p> : null}

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "overdue", "upcoming", "completed", "missed", "all"] as FollowUpFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                activeFilter === filter
                  ? "bg-primary text-white"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4 xl:grid-cols-8">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search lead/phone/city"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All assignees</option>
            {assigneeOptions.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All priority</option>
            {FOLLOW_UP_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All mode</option>
            {FOLLOW_UP_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All status</option>
            {FOLLOW_UP_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All cities</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All sources</option>
            {Array.from(new Set(leads.map((lead) => lead.source_platform))).map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
          <select value={leadPriorityFilter} onChange={(event) => setLeadPriorityFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All lead potential</option>
            {Array.from(new Set(leads.map((lead) => lead.lead_priority))).map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1200px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Assignee</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Latest Note</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFollowUps.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/leads/${item.lead_id}`} className="text-primary hover:underline">
                      {item.lead_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{item.lead_phone}</td>
                  <td className="px-3 py-2">{item.lead_city}</td>
                  <td className="px-3 py-2">{item.assignee_name}</td>
                  <td className="px-3 py-2">{formatDateTime(item.due_at)}</td>
                  <td className="px-3 py-2">{item.priority}</td>
                  <td className="px-3 py-2">{item.mode}</td>
                  <td className="px-3 py-2">{item.status}</td>
                  <td className="px-3 py-2">{item.note ?? "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <a href={`tel:${item.lead_phone}`} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">
                        Call
                      </a>
                      <Link href={`/leads/${item.lead_id}`} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">
                        Open Lead
                      </Link>
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            onClick={() => updateStatus(item, "completed")}
                            disabled={loadingId === item.id}
                            className="rounded border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700"
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            onClick={() => reschedule(item)}
                            disabled={loadingId === item.id}
                            className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700"
                          >
                            Reschedule
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredFollowUps.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                    No follow-ups found for current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
