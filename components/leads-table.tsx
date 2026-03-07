"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Lead } from "@/lib/db-types";
import { PIPELINE_STAGES, formatStageLabel } from "@/lib/lead-options";

export type LeadTableItem = Lead & {
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

export function LeadsTable({ initialLeads }: LeadsTableProps) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return initialLeads.filter((lead) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        lead.full_name.toLowerCase().includes(normalizedQuery) ||
        lead.phone.toLowerCase().includes(normalizedQuery) ||
        (lead.city ?? "").toLowerCase().includes(normalizedQuery);
      const matchesStage = stageFilter === "all" || lead.pipeline_stage === stageFilter;
      return matchesQuery && matchesStage;
    });
  }, [initialLeads, query, stageFilter]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Leads list</h3>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            placeholder="Search name, phone, city"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="all">All stages</option>
            {PIPELINE_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {formatStageLabel(stage)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Next follow-up</th>
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
                    {lead.city ? ` • ${lead.city}` : ""}
                  </p>
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
                <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={7}>
                  No leads found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
