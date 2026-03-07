"use client";

import { useMemo, useState } from "react";
import type { FollowUpStatus } from "@/lib/db-types";
import { FOLLOW_UP_STATUSES } from "@/lib/lead-options";

export type FollowUpListItem = {
  id: string;
  lead_id: string;
  lead_name: string;
  assigned_user_id: string;
  assignee_name: string;
  due_at: string;
  status: FollowUpStatus;
  note: string | null;
  created_at: string;
};

type FollowUpsTableProps = {
  initialFollowUps: FollowUpListItem[];
  canManage: boolean;
};

type FollowUpFilter = "all" | "today" | "overdue" | "upcoming";

function toDate(value: string): Date {
  return new Date(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "-";
  }
  return date.toLocaleString();
}

export function FollowUpsTable({ initialFollowUps, canManage }: FollowUpsTableProps) {
  const [followUps, setFollowUps] = useState(initialFollowUps);
  const [activeFilter, setActiveFilter] = useState<FollowUpFilter>("all");
  const [loadingId, setLoadingId] = useState("");

  const filteredFollowUps = useMemo(() => {
    const now = new Date();
    return followUps.filter((item) => {
      if (activeFilter === "all") {
        return true;
      }

      const dueDate = toDate(item.due_at);
      const dueDay = dueDate.toDateString();
      const today = now.toDateString();

      if (activeFilter === "today") {
        return dueDay === today;
      }
      if (activeFilter === "overdue") {
        return dueDate < now && item.status === "pending";
      }
      if (activeFilter === "upcoming") {
        return dueDate > now;
      }
      return true;
    });
  }, [followUps, activeFilter]);

  async function updateStatus(id: string, status: FollowUpStatus) {
    setLoadingId(id);
    const response = await fetch(`/api/follow-ups/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      setFollowUps((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    }
    setLoadingId("");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "today", "overdue", "upcoming"] as FollowUpFilter[]).map((filter) => (
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

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {filteredFollowUps.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{item.lead_name}</td>
                <td className="px-4 py-3 text-slate-700">{item.assignee_name}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(item.due_at)}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <select
                      value={item.status}
                      onChange={(event) =>
                        updateStatus(item.id, event.target.value as FollowUpStatus)
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      disabled={loadingId === item.id}
                    >
                      {FOLLOW_UP_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-700">{item.status}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">{item.note ?? "-"}</td>
              </tr>
            ))}
            {filteredFollowUps.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                  No follow-ups in this segment.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
