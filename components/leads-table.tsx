"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LeadStatus, PipelineStage } from "@/lib/db-types";
import { LEAD_PRIORITIES, PIPELINE_STAGES, SOURCE_PLATFORMS, formatStageLabel } from "@/lib/lead-options";

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

function priorityBadge(priority: string): string {
  if (priority === "hot") {
    return "bg-rose-100 text-rose-700";
  }
  if (priority === "warm") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

export function LeadsTable({ initialLeads }: LeadsTableProps) {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const uniqueAssignees = useMemo(
    () =>
      Array.from(
        new Set(
          initialLeads
            .map((lead) => lead.assignee_name)
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [initialLeads]
  );
  const uniqueCities = useMemo(
    () =>
      Array.from(
        new Set(initialLeads.map((lead) => lead.city).filter((value): value is string => Boolean(value)))
      ).sort(),
    [initialLeads]
  );

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return initialLeads.filter((lead) => {
      if (
        normalizedQuery &&
        ![
          lead.full_name,
          lead.phone,
          lead.email ?? "",
          lead.city ?? ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return false;
      }
      if (sourceFilter !== "all" && lead.source_platform !== sourceFilter) {
        return false;
      }
      if (priorityFilter !== "all" && lead.lead_priority !== priorityFilter) {
        return false;
      }
      if (assigneeFilter !== "all" && (lead.assignee_name ?? "Unassigned") !== assigneeFilter) {
        return false;
      }
      if (cityFilter !== "all" && (lead.city ?? "Unknown") !== cityFilter) {
        return false;
      }
      if (stageFilter !== "all" && lead.pipeline_stage !== stageFilter) {
        return false;
      }
      const created = new Date(lead.created_at);
      if (Number.isNaN(created.valueOf())) {
        return false;
      }
      if (fromDate) {
        const from = new Date(`${fromDate}T00:00:00`);
        if (created < from) {
          return false;
        }
      }
      if (toDate) {
        const to = new Date(`${toDate}T23:59:59`);
        if (created > to) {
          return false;
        }
      }
      return true;
    });
  }, [
    assigneeFilter,
    cityFilter,
    fromDate,
    initialLeads,
    priorityFilter,
    query,
    sourceFilter,
    stageFilter,
    toDate
  ]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <input
          placeholder="Search name, phone, email, city"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary md:col-span-2"
        />
        <select
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">All sources</option>
          {SOURCE_PLATFORMS.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">All priority</option>
          {LEAD_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(event) => setAssigneeFilter(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">All assignees</option>
          <option value="Unassigned">Unassigned</option>
          {uniqueAssignees.map((assignee) => (
            <option key={assignee} value={assignee}>
              {assignee}
            </option>
          ))}
        </select>
        <select
          value={cityFilter}
          onChange={(event) => setCityFilter(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">All cities</option>
          {uniqueCities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
        <select
          value={stageFilter}
          onChange={(event) => setStageFilter(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">All stages</option>
          {PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {formatStageLabel(stage)}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Next Follow-up</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                    {lead.full_name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {lead.phone}
                    {lead.email ? ` | ${lead.email}` : ""}
                    {lead.city ? ` | ${lead.city}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-700">{lead.source_platform}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${priorityBadge(lead.lead_priority)}`}>
                    {lead.lead_priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatStageLabel(lead.pipeline_stage)}</td>
                <td className="px-4 py-3 text-slate-700">{lead.lead_status}</td>
                <td className="px-4 py-3 text-slate-700">{lead.score}</td>
                <td className="px-4 py-3 text-slate-700">{lead.assignee_name ?? "Unassigned"}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(lead.next_followup_at)}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(lead.created_at)}</td>
              </tr>
            ))}
            {filteredLeads.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={9}>
                  No leads found for your current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
