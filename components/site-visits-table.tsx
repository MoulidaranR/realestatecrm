"use client";

import { useState } from "react";
import type { SiteVisitStatus } from "@/lib/db-types";
import { SITE_VISIT_STATUSES } from "@/lib/lead-options";

export type SiteVisitListItem = {
  id: string;
  lead_id: string;
  lead_name: string;
  assigned_sales_user_id: string;
  assignee_name: string;
  visit_date: string;
  visit_status: SiteVisitStatus;
  pickup_required: boolean;
  outcome_note: string | null;
  created_at: string;
};

type SiteVisitsTableProps = {
  initialSiteVisits: SiteVisitListItem[];
  canManage: boolean;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "-";
  }
  return date.toLocaleString();
}

export function SiteVisitsTable({ initialSiteVisits, canManage }: SiteVisitsTableProps) {
  const [siteVisits, setSiteVisits] = useState(initialSiteVisits);
  const [loadingId, setLoadingId] = useState("");

  async function updateStatus(id: string, status: SiteVisitStatus) {
    setLoadingId(id);
    const response = await fetch(`/api/site-visits/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      setSiteVisits((prev) =>
        prev.map((item) => (item.id === id ? { ...item, visit_status: status } : item))
      );
    }
    setLoadingId("");
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Lead</th>
            <th className="px-4 py-3">Assignee</th>
            <th className="px-4 py-3">Visit date</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Pickup</th>
            <th className="px-4 py-3">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {siteVisits.map((visit) => (
            <tr key={visit.id} className="border-b border-slate-100">
              <td className="px-4 py-3 font-medium text-slate-800">{visit.lead_name}</td>
              <td className="px-4 py-3 text-slate-700">{visit.assignee_name}</td>
              <td className="px-4 py-3 text-slate-700">{formatDateTime(visit.visit_date)}</td>
              <td className="px-4 py-3">
                {canManage ? (
                  <select
                    value={visit.visit_status}
                    onChange={(event) =>
                      updateStatus(visit.id, event.target.value as SiteVisitStatus)
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    disabled={loadingId === visit.id}
                  >
                    {SITE_VISIT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-700">{visit.visit_status}</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-700">{visit.pickup_required ? "Yes" : "No"}</td>
              <td className="px-4 py-3 text-slate-700">{visit.outcome_note ?? "-"}</td>
            </tr>
          ))}
          {siteVisits.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={6}>
                No site visits scheduled yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
