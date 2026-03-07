"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SiteVisitStatus, UserProfile } from "@/lib/db-types";
import { SITE_VISIT_STATUSES } from "@/lib/lead-options";

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

export function SiteVisitsTable({ initialSiteVisits, leads, users, canManage }: SiteVisitsTableProps) {
  const [siteVisits, setSiteVisits] = useState(initialSiteVisits);
  const [activeFilter, setActiveFilter] = useState<VisitFilter>("today");
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pickupFilter, setPickupFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const assigneeOptions = useMemo(
    () => Array.from(new Set(siteVisits.map((item) => item.assignee_name))).sort(),
    [siteVisits]
  );
  const projectOptions = useMemo(
    () =>
      Array.from(
        new Set(siteVisits.map((item) => item.project_name).filter((value): value is string => Boolean(value)))
      ).sort(),
    [siteVisits]
  );
  const cityOptions = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.city || "Unknown"))).sort(),
    [leads]
  );

  const filteredVisits = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const normalizedSearch = search.trim().toLowerCase();
    return siteVisits.filter((item) => {
      const visitDate = new Date(item.visit_date);
      if (Number.isNaN(visitDate.valueOf())) {
        return false;
      }
      const isToday = visitDate.toDateString() === today;
      const isUpcoming = visitDate > now && ["scheduled", "rescheduled"].includes(item.visit_status);

      if (activeFilter === "today" && !isToday) {
        return false;
      }
      if (activeFilter === "upcoming" && !isUpcoming) {
        return false;
      }
      if (activeFilter !== "all" && !["today", "upcoming"].includes(activeFilter) && item.visit_status !== activeFilter) {
        return false;
      }
      if (
        normalizedSearch &&
        !`${item.lead_name} ${item.lead_phone} ${item.project_name ?? ""} ${item.location ?? ""}`
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        return false;
      }
      if (assigneeFilter !== "all" && item.assignee_name !== assigneeFilter) {
        return false;
      }
      if (projectFilter !== "all" && (item.project_name ?? "Unknown") !== projectFilter) {
        return false;
      }
      if (cityFilter !== "all" && item.lead_city !== cityFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.visit_status !== statusFilter) {
        return false;
      }
      if (pickupFilter !== "all") {
        const pickupValue = pickupFilter === "yes";
        if (item.pickup_required !== pickupValue) {
          return false;
        }
      }
      if (sourceFilter !== "all" && item.lead_source_platform !== sourceFilter) {
        return false;
      }
      if (priorityFilter !== "all" && item.lead_priority !== priorityFilter) {
        return false;
      }
      if (fromDate) {
        const from = new Date(`${fromDate}T00:00:00`);
        if (visitDate < from) {
          return false;
        }
      }
      if (toDate) {
        const to = new Date(`${toDate}T23:59:59`);
        if (visitDate > to) {
          return false;
        }
      }
      return true;
    });
  }, [
    activeFilter,
    assigneeFilter,
    cityFilter,
    fromDate,
    pickupFilter,
    priorityFilter,
    projectFilter,
    search,
    siteVisits,
    sourceFilter,
    statusFilter,
    toDate
  ]);

  async function createSiteVisit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoadingId("create");
    const response = await fetch("/api/site-visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const payload = (await response.json()) as { error?: string; id?: string };
    if (!response.ok || !payload.id) {
      setError(payload.error ?? "Failed to create site visit");
      setLoadingId("");
      return;
    }
    const createdId = payload.id;
    const lead = leads.find((item) => item.id === form.leadId);
    const assignee = users.find((item) => item.id === form.assignedSalesUserId);
    setSiteVisits((prev) => [
      {
        id: createdId,
        lead_id: form.leadId,
        lead_name: lead?.full_name ?? "Unknown lead",
        lead_phone: lead?.phone ?? "-",
        lead_city: lead?.city ?? "Unknown",
        lead_source_platform: lead?.source_platform ?? "unknown",
        lead_priority: lead?.lead_priority ?? "warm",
        assigned_sales_user_id: form.assignedSalesUserId,
        assignee_name: assignee?.full_name ?? "Unknown user",
        visit_date: new Date(form.visitDate).toISOString(),
        visit_status: form.visitStatus,
        project_name: form.projectName || null,
        location: form.location || null,
        pickup_required: form.pickupRequired,
        pickup_address: form.pickupAddress || null,
        outcome: form.outcome || null,
        notes: form.notes || null,
        next_action: form.nextAction || null,
        next_followup_at: form.nextFollowupAt ? new Date(form.nextFollowupAt).toISOString() : null,
        created_at: new Date().toISOString()
      },
      ...prev
    ]);
    setForm((prev) => ({
      ...prev,
      visitDate: "",
      projectName: "",
      location: "",
      pickupAddress: "",
      outcome: "",
      notes: "",
      nextAction: "",
      nextFollowupAt: ""
    }));
    setSuccess("Site visit created.");
    setLoadingId("");
  }

  async function updateStatus(item: SiteVisitListItem, status: SiteVisitStatus) {
    setLoadingId(item.id);
    setError("");
    setSuccess("");
    const response = await fetch(`/api/site-visits/${item.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        outcome: item.outcome,
        notes: item.notes,
        nextAction: item.next_action,
        nextFollowupAt: item.next_followup_at
      })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to update site visit");
      setLoadingId("");
      return;
    }
    setSiteVisits((prev) =>
      prev.map((entry) => (entry.id === item.id ? { ...entry, visit_status: status } : entry))
    );
    setSuccess("Site visit status updated.");
    setLoadingId("");
  }

  return (
    <div className="space-y-3">
      {canManage ? (
        <form onSubmit={createSiteVisit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Schedule Site Visit</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select value={form.leadId} onChange={(event) => setForm((prev) => ({ ...prev, leadId: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.full_name} ({lead.phone})
                </option>
              ))}
            </select>
            <select value={form.assignedSalesUserId} onChange={(event) => setForm((prev) => ({ ...prev, assignedSalesUserId: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
            <input type="datetime-local" value={form.visitDate} onChange={(event) => setForm((prev) => ({ ...prev, visitDate: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            <input placeholder="Project / property name" value={form.projectName} onChange={(event) => setForm((prev) => ({ ...prev, projectName: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Location" value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={form.visitStatus} onChange={(event) => setForm((prev) => ({ ...prev, visitStatus: event.target.value as SiteVisitStatus }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {SITE_VISIT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <input type="checkbox" checked={form.pickupRequired} onChange={(event) => setForm((prev) => ({ ...prev, pickupRequired: event.target.checked }))} />
              Pickup required
            </label>
            <input placeholder="Pickup address" value={form.pickupAddress} onChange={(event) => setForm((prev) => ({ ...prev, pickupAddress: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="datetime-local" value={form.nextFollowupAt} onChange={(event) => setForm((prev) => ({ ...prev, nextFollowupAt: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input placeholder="Outcome" value={form.outcome} onChange={(event) => setForm((prev) => ({ ...prev, outcome: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Next action" value={form.nextAction} onChange={(event) => setForm((prev) => ({ ...prev, nextAction: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Notes" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={loadingId === "create"} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {loadingId === "create" ? "Saving..." : "Create Site Visit"}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          You can view site visits but cannot create or modify them with your current role.
        </div>
      )}

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {success ? <p className="text-sm font-semibold text-emerald-600">{success}</p> : null}

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "upcoming", "completed", "cancelled", "no_show", "rescheduled", "all"] as VisitFilter[]).map((filter) => (
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
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lead/phone/project" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All assignees</option>
            {assigneeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All projects</option>
            <option value="Unknown">Unknown</option>
            {projectOptions.map((option) => (
              <option key={option} value={option}>
                {option}
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
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All status</option>
            {SITE_VISIT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select value={pickupFilter} onChange={(event) => setPickupFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Pickup any</option>
            <option value="yes">Pickup yes</option>
            <option value="no">Pickup no</option>
          </select>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All sources</option>
            {Array.from(new Set(leads.map((lead) => lead.source_platform))).map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All potential</option>
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
          <table className="min-w-[1300px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Visit Date</th>
                <th className="px-3 py-2">Assignee</th>
                <th className="px-3 py-2">Pickup</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Next Action</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisits.map((visit) => (
                <tr key={visit.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/leads/${visit.lead_id}`} className="text-primary hover:underline">
                      {visit.lead_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{visit.lead_phone}</td>
                  <td className="px-3 py-2">{visit.project_name ?? "-"}</td>
                  <td className="px-3 py-2">{formatDateTime(visit.visit_date)}</td>
                  <td className="px-3 py-2">{visit.assignee_name}</td>
                  <td className="px-3 py-2">{visit.pickup_required ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{visit.visit_status}</td>
                  <td className="px-3 py-2">{visit.outcome ?? "-"}</td>
                  <td className="px-3 py-2">{visit.next_action ?? "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Link href={`/leads/${visit.lead_id}`} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">
                        Open Lead
                      </Link>
                      {canManage ? (
                        <>
                          <button type="button" onClick={() => updateStatus(visit, "completed")} disabled={loadingId === visit.id} className="rounded border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700">
                            Complete
                          </button>
                          <button type="button" onClick={() => updateStatus(visit, "rescheduled")} disabled={loadingId === visit.id} className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700">
                            Reschedule
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVisits.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                    No site visits found for current filters.
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
