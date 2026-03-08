"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FollowUpMode, FollowUpPriority, FollowUpStatus, UserProfile } from "@/lib/db-types";
import { FOLLOW_UP_MODES, FOLLOW_UP_PRIORITIES } from "@/lib/lead-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

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

function fmt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function priorityVariant(p: string): "danger" | "warning" | "info" | "default" {
  if (p === "high" || p === "urgent") return "danger";
  if (p === "medium") return "warning";
  if (p === "low") return "info";
  return "default";
}

function statusVariant(s: string): "success" | "danger" | "warning" | "default" | "info" {
  if (s === "completed") return "success";
  if (s === "missed") return "danger";
  if (s === "cancelled") return "default";
  if (s === "pending") return "warning";
  return "info";
}

const selectCls = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500";

const FILTER_TABS: { key: FollowUpFilter; label: string; color: string }[] = [
  { key: "today", label: "Today", color: "bg-primary-600" },
  { key: "overdue", label: "Overdue", color: "bg-danger-600" },
  { key: "upcoming", label: "Upcoming", color: "bg-info-600" },
  { key: "completed", label: "Completed", color: "bg-success-600" },
  { key: "missed", label: "Missed", color: "bg-warning-600" },
  { key: "all", label: "All", color: "bg-slate-700" }
];

export function FollowUpsTable({ initialFollowUps, leads, users, canManage }: FollowUpsTableProps) {
  const [followUps, setFollowUps] = useState(initialFollowUps);
  const [activeFilter, setActiveFilter] = useState<FollowUpFilter>("today");
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [loadingId, setLoadingId] = useState("");
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
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

  const assigneeOptions = useMemo(
    () => Array.from(new Set(followUps.map((i) => i.assignee_name))).sort(),
    [followUps]
  );

  const filteredFollowUps = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const q = search.trim().toLowerCase();
    return followUps.filter((item) => {
      const dueDate = new Date(item.due_at);
      const isToday = dueDate.toDateString() === today;
      const isOverdue = dueDate < now && item.status === "pending";
      const isUpcoming = dueDate > now && item.status === "pending";

      if (activeFilter === "today" && !isToday) return false;
      if (activeFilter === "overdue" && !isOverdue) return false;
      if (activeFilter === "upcoming" && !isUpcoming) return false;
      if (activeFilter === "completed" && item.status !== "completed") return false;
      if (activeFilter === "missed" && item.status !== "missed") return false;

      if (q && !`${item.lead_name} ${item.lead_phone} ${item.lead_city}`.toLowerCase().includes(q)) return false;
      if (assigneeFilter !== "all" && item.assignee_name !== assigneeFilter) return false;
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      if (modeFilter !== "all" && item.mode !== modeFilter) return false;
      return true;
    });
  }, [activeFilter, assigneeFilter, followUps, modeFilter, priorityFilter, search]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const counts: Record<FollowUpFilter, number> = { today: 0, overdue: 0, upcoming: 0, completed: 0, missed: 0, all: followUps.length };
    for (const item of followUps) {
      const d = new Date(item.due_at);
      if (d.toDateString() === today) counts.today++;
      if (d < now && item.status === "pending") counts.overdue++;
      if (d > now && item.status === "pending") counts.upcoming++;
      if (item.status === "completed") counts.completed++;
      if (item.status === "missed") counts.missed++;
    }
    return counts;
  }, [followUps]);

  async function createFollowUp(e: React.FormEvent) {
    e.preventDefault();
    setLoadingId("create");
    const res = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const json = (await res.json()) as { error?: string; id?: string };
    if (!res.ok || !json.id) {
      toast("error", json.error ?? "Failed to create follow-up");
      setLoadingId("");
      return;
    }
    const lead = leads.find((l) => l.id === form.leadId);
    const user = users.find((u) => u.id === form.assignedUserId);
    setFollowUps((prev) => [{
      id: json.id as string,
      lead_id: form.leadId,
      lead_name: lead?.full_name ?? "Unknown lead",
      lead_phone: lead?.phone ?? "-",
      lead_city: lead?.city ?? "Unknown",
      lead_source_platform: lead?.source_platform ?? "unknown",
      lead_priority: lead?.lead_priority ?? "warm",
      assigned_user_id: form.assignedUserId,
      assignee_name: user?.full_name ?? "Unknown",
      due_at: new Date(form.dueAt).toISOString(),
      status: form.status,
      mode: form.mode,
      purpose: form.purpose || null,
      outcome: form.outcome || null,
      priority: form.priority,
      note: form.note || null,
      next_followup_at: form.nextFollowupAt ? new Date(form.nextFollowupAt).toISOString() : null,
      completed_at: null,
      created_at: new Date().toISOString()
    }, ...prev]);
    setForm((p) => ({ ...p, dueAt: "", purpose: "", outcome: "", note: "", nextFollowupAt: "" }));
    setShowForm(false);
    toast("success", "Follow-up created.");
    setLoadingId("");
  }

  async function updateStatus(item: FollowUpListItem, status: FollowUpStatus, nextFollowupAt: string | null = null) {
    setLoadingId(item.id);
    const res = await fetch(`/api/follow-ups/${item.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, nextFollowupAt, outcome: item.outcome, note: item.note })
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) { toast("error", json.error ?? "Update failed"); setLoadingId(""); return; }
    setFollowUps((prev) => prev.map((e) => e.id === item.id ? { ...e, status, next_followup_at: nextFollowupAt ? new Date(nextFollowupAt).toISOString() : e.next_followup_at, completed_at: status === "completed" ? new Date().toISOString() : e.completed_at } : e));
    toast("success", `Follow-up ${status}.`);
    setLoadingId("");
  }

  async function reschedule(item: FollowUpListItem) {
    const next = window.prompt("New follow-up datetime (YYYY-MM-DDTHH:mm)", "");
    if (!next) return;
    await updateStatus(item, "pending", next);
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface p-1.5 shadow-card overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              activeFilter === tab.key
                ? `${tab.color} text-white shadow-sm`
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeFilter === tab.key ? "bg-white/25 text-white" : "bg-slate-200 text-slate-600"}`}>
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lead / phone / city…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={selectCls}>
            <option value="all">All assignees</option>
            {assigneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={selectCls}>
            <option value="all">All priority</option>
            {FOLLOW_UP_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className={selectCls}>
            <option value="all">All modes</option>
            {FOLLOW_UP_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowForm(!showForm)}
              icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
            >
              Create
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Showing <strong className="text-text-primary">{filteredFollowUps.length}</strong> results
        </p>
      </div>

      {/* Create form (collapsible) */}
      {canManage && showForm && (
        <form onSubmit={createFollowUp} className="rounded-xl border border-border bg-surface p-5 shadow-card space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-text-primary">New Follow-up</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select value={form.leadId} onChange={(e) => setForm((p) => ({ ...p, leadId: e.target.value }))} className={selectCls} required>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.full_name} ({l.phone})</option>)}
            </select>
            <select value={form.assignedUserId} onChange={(e) => setForm((p) => ({ ...p, assignedUserId: e.target.value }))} className={selectCls}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <input type="datetime-local" value={form.dueAt} onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))} className={selectCls} required />
            <select value={form.mode} onChange={(e) => setForm((p) => ({ ...p, mode: e.target.value as FollowUpMode }))} className={selectCls}>
              {FOLLOW_UP_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as FollowUpPriority }))} className={selectCls}>
              {FOLLOW_UP_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input placeholder="Purpose" value={form.purpose} onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))} className={selectCls} />
          </div>
          <textarea rows={2} placeholder="Notes" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} className={`${selectCls} w-full`} />
          <div className="flex gap-2">
            <Button variant="primary" type="submit" loading={loadingId === "create"}>Create Follow-up</Button>
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {!canManage && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-text-muted">
          You can view follow-ups but cannot create or modify them with your current role.
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="table-container scrollbar-thin">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {["Lead", "Assignee", "Due", "Priority", "Mode", "Status", "Note", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFollowUps.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState compact title={`No ${activeFilter === "all" ? "" : activeFilter + " "}follow-ups`} description="Adjust your filters or create a new follow-up." />
                  </td>
                </tr>
              ) : (
                filteredFollowUps.map((item) => {
                  const isOverdue = new Date(item.due_at) < new Date() && item.status === "pending";
                  const isBusy = loadingId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/leads/${item.lead_id}`} className="font-medium text-primary-600 hover:underline truncate block max-w-[150px]">
                          {item.lead_name}
                        </Link>
                        <p className="text-[11px] text-text-muted mt-0.5">{item.lead_phone}{item.lead_city ? ` · ${item.lead_city}` : ""}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{item.assignee_name}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className={isOverdue ? "text-danger-600 font-semibold" : "text-text-secondary"}>
                          {isOverdue && "⚠ "}{fmt(item.due_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3"><Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge></td>
                      <td className="px-4 py-3"><Badge variant="default">{item.mode}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={statusVariant(item.status)} dot>{item.status}</Badge></td>
                      <td className="px-4 py-3 text-xs text-text-muted max-w-[140px] truncate">{item.note ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <a href={`tel:${item.lead_phone}`} className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors" title="Call">📞</a>
                          {canManage && item.status === "pending" && (
                            <>
                              <button type="button" onClick={() => updateStatus(item, "completed")} disabled={isBusy} className="rounded-lg border border-success-300 bg-success-50 px-2 py-1 text-[11px] font-semibold text-success-700 hover:bg-success-100 disabled:opacity-50 transition-colors">✓</button>
                              <button type="button" onClick={() => reschedule(item)} disabled={isBusy} className="rounded-lg border border-warning-300 bg-warning-50 px-2 py-1 text-[11px] font-semibold text-warning-700 hover:bg-warning-100 disabled:opacity-50 transition-colors">↻</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
