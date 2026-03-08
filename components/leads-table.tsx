"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LeadStatus, PipelineStage } from "@/lib/db-types";
import { LEAD_PRIORITIES, PIPELINE_STAGES, SOURCE_PLATFORMS, formatStageLabel } from "@/lib/lead-options";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export type LeadTableItem = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  source_platform: string;
  lead_priority: string;
  pipeline_stage: PipelineStage;
  lead_status: LeadStatus;
  score: number;
  next_followup_at: string | null;
  created_at: string;
  assignee_name: string | null;
};

type LeadsTableProps = {
  initialLeads: LeadTableItem[];
};

function fmt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function priorityVariant(p: string): "danger" | "warning" | "default" {
  if (p === "hot") return "danger";
  if (p === "warm") return "warning";
  return "default";
}

function statusVariant(s: string): "success" | "danger" | "default" | "info" {
  if (s === "won") return "success";
  if (s === "lost") return "danger";
  if (s === "cold") return "info";
  return "default";
}

export function LeadsTable({ initialLeads }: LeadsTableProps) {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const uniqueAssignees = useMemo(
    () => Array.from(new Set(initialLeads.map((l) => l.assignee_name).filter(Boolean) as string[])).sort(),
    [initialLeads]
  );

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialLeads.filter((lead) => {
      if (q && ![lead.full_name, lead.phone, lead.email ?? "", lead.city ?? ""].join(" ").toLowerCase().includes(q)) return false;
      if (sourceFilter !== "all" && lead.source_platform !== sourceFilter) return false;
      if (priorityFilter !== "all" && lead.lead_priority !== priorityFilter) return false;
      if (assigneeFilter !== "all" && (lead.assignee_name ?? "Unassigned") !== assigneeFilter) return false;
      if (stageFilter !== "all" && lead.pipeline_stage !== stageFilter) return false;
      const created = new Date(lead.created_at);
      if (Number.isNaN(created.valueOf())) return false;
      if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && created > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [query, sourceFilter, priorityFilter, assigneeFilter, stageFilter, fromDate, toDate, initialLeads]);

  const selectCls = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500";


  const hasActiveFilter = query || sourceFilter !== "all" || priorityFilter !== "all" || assigneeFilter !== "all" || stageFilter !== "all" || fromDate || toDate;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-col gap-3">
          {/* Search row */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              placeholder="Search by name, phone, email or city…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          {/* Filter controls */}
          <div className="flex flex-wrap gap-2">
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={selectCls}>
              <option value="all">All sources</option>
              {SOURCE_PLATFORMS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={selectCls}>
              <option value="all">All priority</option>
              {LEAD_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={selectCls}>
              <option value="all">All assignees</option>
              <option value="Unassigned">Unassigned</option>
              {uniqueAssignees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className={selectCls}>
              <option value="all">All stages</option>
              {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{formatStageLabel(s)}</option>)}
            </select>
            <div className="flex items-center gap-1.5">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-primary-500" />
              <span className="text-slate-400 text-xs">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => { setQuery(""); setSourceFilter("all"); setPriorityFilter("all"); setAssigneeFilter("all"); setStageFilter("all"); setFromDate(""); setToDate(""); }}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-100 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">
              Showing <strong className="text-text-primary">{filteredLeads.length}</strong> of {initialLeads.length} leads
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="table-container scrollbar-thin">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {["Lead", "Source", "Priority", "Stage", "Status", "Score", "Assigned To", "Next Follow-up", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      compact
                      title={hasActiveFilter ? "No leads match your filters" : "No leads yet"}
                      description={hasActiveFilter ? "Try adjusting your search or filter criteria." : "Create your first lead to get started."}
                      action={hasActiveFilter ? (
                        <button
                          type="button"
                          onClick={() => { setQuery(""); setSourceFilter("all"); setPriorityFilter("all"); setAssigneeFilter("all"); setStageFilter("all"); setFromDate(""); setToDate(""); }}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Clear filters
                        </button>
                      ) : undefined}
                    />
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const isOverdue = lead.next_followup_at && new Date(lead.next_followup_at) < new Date();
                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/leads/${lead.id}`} className="font-medium text-primary-600 hover:underline block truncate max-w-[180px]">
                          {lead.full_name}
                        </Link>
                        <p className="text-[11px] text-text-muted mt-0.5 truncate max-w-[180px]">
                          {lead.phone}{lead.city ? ` · ${lead.city}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-text-secondary capitalize whitespace-nowrap">
                        {lead.source_platform.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={priorityVariant(lead.lead_priority)} dot>{lead.lead_priority}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">
                        {formatStageLabel(lead.pipeline_stage)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(lead.lead_status)}>{lead.lead_status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(100, lead.score)}%` }} />
                          </div>
                          <span className="text-xs text-text-muted">{lead.score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {lead.assignee_name ?? <span className="text-text-muted italic">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {lead.next_followup_at ? (
                          <span className={isOverdue ? "text-danger-600 font-medium" : "text-text-secondary"}>
                            {isOverdue && "⚠ "}{fmt(lead.next_followup_at)}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">{fmt(lead.created_at)}</td>
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
