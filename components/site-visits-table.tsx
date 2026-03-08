"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SiteVisitStatus, UserProfile } from "@/lib/db-types";
// import type only needed for SiteVisitStatus above
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

export type SiteVisitListItem = {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_phone: string;
  lead_city: string;
  lead_source_platform: string;
  lead_priority: string;
  assigned_sales_user_id: string;
  assignee_name: string;
  visit_date: string;
  visit_status: SiteVisitStatus;
  project_name: string | null;
  location: string | null;
  pickup_required: boolean;
  pickup_address: string | null;
  outcome: string | null;
  notes: string | null;
  next_action: string | null;
  next_followup_at: string | null;
  created_at: string;
};

type SiteVisitLeadOption = {
  id: string;
  full_name: string;
  phone: string;
  city: string | null;
  source_platform: string;
  lead_priority: string;
};

type SiteVisitsTableProps = {
  initialSiteVisits: SiteVisitListItem[];
  leads: SiteVisitLeadOption[];
  users: Array<Pick<UserProfile, "id" | "full_name" | "role_key" | "status">>;
  canManage: boolean;
};

type VisitFilter = "today" | "upcoming" | "completed" | "cancelled" | "no_show" | "rescheduled" | "all";

function fmt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function visitVariant(s: string): "success" | "danger" | "warning" | "info" | "default" {
  if (s === "completed") return "success";
  if (s === "cancelled" || s === "no_show") return "danger";
  if (s === "rescheduled") return "warning";
  if (s === "scheduled") return "info";
  return "default";
}

const selectCls = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500";

const FILTER_TABS: { key: VisitFilter; label: string; color: string }[] = [
  { key: "today", label: "Today", color: "bg-primary-600" },
  { key: "upcoming", label: "Upcoming", color: "bg-info-600" },
  { key: "completed", label: "Completed", color: "bg-success-600" },
  { key: "cancelled", label: "Cancelled", color: "bg-slate-600" },
  { key: "no_show", label: "No-show", color: "bg-danger-600" },
  { key: "rescheduled", label: "Rescheduled", color: "bg-warning-600" },
  { key: "all", label: "All", color: "bg-slate-700" }
];

export function SiteVisitsTable({ initialSiteVisits, leads, users, canManage }: SiteVisitsTableProps) {
  const [siteVisits, setSiteVisits] = useState(initialSiteVisits);
  const [activeFilter, setActiveFilter] = useState<VisitFilter>("today");
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [loadingId, setLoadingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    leadId: leads[0]?.id ?? "",
    assignedSalesUserId: users[0]?.id ?? "",
    visitDate: "",
    projectName: "",
    location: "",
    pickupRequired: false,
    pickupAddress: "",
    visitStatus: "scheduled" as SiteVisitStatus,
    outcome: "",
    notes: "",
    nextAction: "",
    nextFollowupAt: ""
  });

  const assigneeOpts = useMemo(() => Array.from(new Set(siteVisits.map((v) => v.assignee_name))).sort(), [siteVisits]);

  const tabCounts = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const c: Record<VisitFilter, number> = { today: 0, upcoming: 0, completed: 0, cancelled: 0, no_show: 0, rescheduled: 0, all: siteVisits.length };
    for (const v of siteVisits) {
      const d = new Date(v.visit_date);
      if (d.toDateString() === today) c.today++;
      if (d > now && ["scheduled", "rescheduled"].includes(v.visit_status)) c.upcoming++;
      if (v.visit_status === "completed") c.completed++;
      if (v.visit_status === "cancelled") c.cancelled++;
      if (v.visit_status === "no_show") c.no_show++;
      if (v.visit_status === "rescheduled") c.rescheduled++;
    }
    return c;
  }, [siteVisits]);

  const filteredVisits = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const q = search.trim().toLowerCase();
    return siteVisits.filter((v) => {
      const d = new Date(v.visit_date);
      if (Number.isNaN(d.valueOf())) return false;
      if (activeFilter === "today" && d.toDateString() !== today) return false;
      if (activeFilter === "upcoming" && !(d > now && ["scheduled", "rescheduled"].includes(v.visit_status))) return false;
      if (!["today", "upcoming", "all"].includes(activeFilter) && v.visit_status !== activeFilter) return false;
      if (q && !`${v.lead_name} ${v.lead_phone} ${v.project_name ?? ""} ${v.location ?? ""}`.toLowerCase().includes(q)) return false;
      if (assigneeFilter !== "all" && v.assignee_name !== assigneeFilter) return false;
      return true;
    });
  }, [activeFilter, assigneeFilter, search, siteVisits]);

  async function createSiteVisit(e: React.FormEvent) {
    e.preventDefault();
    setLoadingId("create");
    const res = await fetch("/api/site-visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const json = (await res.json()) as { error?: string; id?: string };
    if (!res.ok || !json.id) { toast("error", json.error ?? "Failed to create"); setLoadingId(""); return; }
    const lead = leads.find((l) => l.id === form.leadId);
    const user = users.find((u) => u.id === form.assignedSalesUserId);
    setSiteVisits((prev) => [{
      id: json.id as string, lead_id: form.leadId,
      lead_name: lead?.full_name ?? "Unknown", lead_phone: lead?.phone ?? "-", lead_city: lead?.city ?? "Unknown",
      lead_source_platform: lead?.source_platform ?? "unknown", lead_priority: lead?.lead_priority ?? "warm",
      assigned_sales_user_id: form.assignedSalesUserId, assignee_name: user?.full_name ?? "Unknown",
      visit_date: new Date(form.visitDate).toISOString(), visit_status: form.visitStatus,
      project_name: form.projectName || null, location: form.location || null,
      pickup_required: form.pickupRequired, pickup_address: form.pickupAddress || null,
      outcome: form.outcome || null, notes: form.notes || null,
      next_action: form.nextAction || null, next_followup_at: form.nextFollowupAt ? new Date(form.nextFollowupAt).toISOString() : null,
      created_at: new Date().toISOString()
    }, ...prev]);
    setForm((p) => ({ ...p, visitDate: "", projectName: "", location: "", pickupAddress: "", outcome: "", notes: "", nextAction: "", nextFollowupAt: "" }));
    setShowForm(false);
    toast("success", "Site visit scheduled.");
    setLoadingId("");
  }

  async function updateStatus(item: SiteVisitListItem, status: SiteVisitStatus) {
    setLoadingId(item.id);
    const res = await fetch(`/api/site-visits/${item.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, outcome: item.outcome, notes: item.notes, nextAction: item.next_action, nextFollowupAt: item.next_followup_at })
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) { toast("error", json.error ?? "Update failed"); setLoadingId(""); return; }
    setSiteVisits((prev) => prev.map((v) => v.id === item.id ? { ...v, visit_status: status } : v));
    toast("success", `Visit marked ${status}.`);
    setLoadingId("");
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
              activeFilter === tab.key ? `${tab.color} text-white shadow-sm` : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeFilter === tab.key ? "bg-white/25" : "bg-slate-200 text-slate-600"}`}>
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search/filter + action */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lead / project / location…" className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
          </div>
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={selectCls}>
            <option value="all">All assignees</option>
            {assigneeOpts.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {canManage && (
            <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}
              icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}>
              Schedule Visit
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Showing <strong className="text-text-primary">{filteredVisits.length}</strong> visits
        </p>
      </div>

      {/* Create form */}
      {canManage && showForm && (
        <form onSubmit={createSiteVisit} className="rounded-xl border border-border bg-surface p-5 shadow-card space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-text-primary">Schedule a Site Visit</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select value={form.leadId} onChange={(e) => setForm((p) => ({ ...p, leadId: e.target.value }))} className={selectCls} required>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.full_name} ({l.phone})</option>)}
            </select>
            <select value={form.assignedSalesUserId} onChange={(e) => setForm((p) => ({ ...p, assignedSalesUserId: e.target.value }))} className={selectCls}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <input type="datetime-local" value={form.visitDate} onChange={(e) => setForm((p) => ({ ...p, visitDate: e.target.value }))} className={selectCls} required />
            <input placeholder="Project / property name" value={form.projectName} onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))} className={selectCls} />
            <input placeholder="Location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} className={selectCls} />
            <label className={`flex items-center gap-2 ${selectCls}`}>
              <input type="checkbox" checked={form.pickupRequired} onChange={(e) => setForm((p) => ({ ...p, pickupRequired: e.target.checked }))} />
              Pickup required
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" type="submit" loading={loadingId === "create"}>Create Site Visit</Button>
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}
      {!canManage && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-text-muted">
          You can view site visits but cannot create or modify them with your current role.
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="table-container scrollbar-thin">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {["Lead", "Project", "Date", "Assignee", "Pickup", "Status", "Outcome", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState compact title={`No ${activeFilter === "all" ? "" : activeFilter.replace("_", "-") + " "}visits`} description="Adjust filters or schedule a new visit." />
                  </td>
                </tr>
              ) : (
                filteredVisits.map((v) => {
                  const isBusy = loadingId === v.id;
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/leads/${v.lead_id}`} className="font-medium text-primary-600 hover:underline truncate block max-w-[150px]">{v.lead_name}</Link>
                        <p className="text-[11px] text-text-muted mt-0.5">{v.lead_phone}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{v.project_name ?? "—"}<br/><span className="text-text-muted">{v.location ?? ""}</span></td>
                      <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">{fmt(v.visit_date)}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{v.assignee_name}</td>
                      <td className="px-4 py-3"><Badge variant={v.pickup_required ? "warning" : "default"} dot>{v.pickup_required ? "Yes" : "No"}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={visitVariant(v.visit_status)} dot>{v.visit_status.replace("_", " ")}</Badge></td>
                      <td className="px-4 py-3 text-xs text-text-muted max-w-[120px] truncate">{v.outcome ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {canManage && ["scheduled", "rescheduled"].includes(v.visit_status) && (
                            <>
                              <button type="button" onClick={() => updateStatus(v, "completed")} disabled={isBusy} className="rounded-lg border border-success-300 bg-success-50 px-2 py-1 text-[11px] font-semibold text-success-700 hover:bg-success-100 disabled:opacity-50 transition-colors">✓</button>
                              <button type="button" onClick={() => updateStatus(v, "no_show")} disabled={isBusy} className="rounded-lg border border-danger-300 bg-danger-50 px-2 py-1 text-[11px] font-semibold text-danger-700 hover:bg-danger-100 disabled:opacity-50 transition-colors">✗</button>
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
