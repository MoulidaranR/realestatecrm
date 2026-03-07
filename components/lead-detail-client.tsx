"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Deal, FollowUp, Lead, LeadNote, SiteVisit, UserProfile } from "@/lib/db-types";
import { formatStageLabel } from "@/lib/lead-options";

type LeadDetailLead = Lead & {
  assignee_name: string | null;
  creator_name: string | null;
};

type LeadDetailClientProps = {
  lead: LeadDetailLead;
  users: Array<Pick<UserProfile, "id" | "full_name" | "role_key" | "status">>;
  notes: Array<LeadNote & { author_name: string | null }>;
  followUps: Array<FollowUp & { assignee_name: string | null }>;
  siteVisits: Array<SiteVisit & { assignee_name: string | null }>;
  deals: Array<Deal & { sales_user_name: string | null }>;
  canAssign: boolean;
  canUpdateLead: boolean;
  canManageFollowUps: boolean;
  canManageSiteVisits: boolean;
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

export function LeadDetailClient({
  lead,
  users,
  notes,
  followUps,
  siteVisits,
  deals,
  canAssign,
  canUpdateLead,
  canManageFollowUps,
  canManageSiteVisits
}: LeadDetailClientProps) {
  const router = useRouter();
  const [assigneeUserId, setAssigneeUserId] = useState(lead.assigned_to ?? "");
  const [noteText, setNoteText] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpAssigneeId, setFollowUpAssigneeId] = useState(lead.assigned_to ?? "");
  const [visitDate, setVisitDate] = useState("");
  const [visitAssigneeId, setVisitAssigneeId] = useState(lead.assigned_to ?? "");
  const [visitPickupRequired, setVisitPickupRequired] = useState(false);
  const [visitOutcomeNote, setVisitOutcomeNote] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [bookingAmount, setBookingAmount] = useState("");
  const [dealStatus, setDealStatus] = useState<"booked" | "closed" | "lost">("booked");
  const [dealSalesUserId, setDealSalesUserId] = useState(lead.assigned_to ?? "");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadingAction, setLoadingAction] = useState("");

  const activeUsers = users.filter((user) => user.status === "active");

  async function handleAssignLead() {
    setLoadingAction("assign");
    setActionError("");
    setActionMessage("");

    const response = await fetch(`/api/leads/${lead.id}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeUserId: assigneeUserId || null })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setActionError(payload.error ?? "Failed to assign lead");
      setLoadingAction("");
      return;
    }

    setActionMessage("Lead assignment updated.");
    setLoadingAction("");
    router.refresh();
  }

  async function handleAddNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction("note");
    setActionError("");
    setActionMessage("");

    const response = await fetch(`/api/leads/${lead.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteText })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setActionError(payload.error ?? "Failed to add note");
      setLoadingAction("");
      return;
    }

    setNoteText("");
    setActionMessage("Note added.");
    setLoadingAction("");
    router.refresh();
  }

  async function handleCreateFollowUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction("follow_up");
    setActionError("");
    setActionMessage("");

    const response = await fetch(`/api/leads/${lead.id}/follow-ups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dueAt: followUpDueAt,
        note: followUpNote,
        assignedUserId: followUpAssigneeId || null
      })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setActionError(payload.error ?? "Failed to schedule follow-up");
      setLoadingAction("");
      return;
    }

    setFollowUpDueAt("");
    setFollowUpNote("");
    setActionMessage("Follow-up scheduled.");
    setLoadingAction("");
    router.refresh();
  }

  async function handleCreateSiteVisit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction("site_visit");
    setActionError("");
    setActionMessage("");

    const response = await fetch(`/api/leads/${lead.id}/site-visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitDate,
        assignedSalesUserId: visitAssigneeId || null,
        pickupRequired: visitPickupRequired,
        outcomeNote: visitOutcomeNote
      })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setActionError(payload.error ?? "Failed to schedule site visit");
      setLoadingAction("");
      return;
    }

    setVisitDate("");
    setVisitPickupRequired(false);
    setVisitOutcomeNote("");
    setActionMessage("Site visit scheduled.");
    setLoadingAction("");
    router.refresh();
  }

  async function handleCreateDeal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAction("deal");
    setActionError("");
    setActionMessage("");

    const response = await fetch(`/api/leads/${lead.id}/deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salesUserId: dealSalesUserId || null,
        dealValue: Number(dealValue || 0),
        bookingAmount: Number(bookingAmount || 0),
        dealStatus
      })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setActionError(payload.error ?? "Failed to create deal");
      setLoadingAction("");
      return;
    }

    setDealValue("");
    setBookingAmount("");
    setActionMessage("Deal captured.");
    setLoadingAction("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{lead.full_name}</h2>
            <p className="text-sm text-slate-600">
              {lead.phone}
              {lead.email ? ` • ${lead.email}` : ""}
              {lead.city ? ` • ${lead.city}` : ""}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Stage: {formatStageLabel(lead.pipeline_stage)} | Status: {lead.lead_status} | Score:{" "}
              {lead.score}
            </p>
            <p className="text-xs text-slate-500">
              Created by: {lead.creator_name ?? "Unknown"} | Source: {lead.source}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <p>Assigned to: {lead.assignee_name ?? "Unassigned"}</p>
            <p>Next follow-up: {formatDateTime(lead.next_followup_at)}</p>
            <p>Last contacted: {formatDateTime(lead.last_contacted_at)}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Lead actions</h3>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reassign lead
            </label>
            <div className="flex items-center gap-2">
              <select
                value={assigneeUserId}
                onChange={(event) => setAssigneeUserId(event.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!canAssign || loadingAction === "assign"}
              >
                <option value="">Unassigned</option>
                {activeUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.role_key})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAssignLead}
                disabled={!canAssign || loadingAction === "assign"}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {loadingAction === "assign" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <form onSubmit={handleAddNote} className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Add note
            </label>
            <textarea
              rows={3}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Call summary, objections, decision maker details..."
              disabled={!canUpdateLead || loadingAction === "note"}
              required
            />
            <button
              type="submit"
              disabled={!canUpdateLead || loadingAction === "note"}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              {loadingAction === "note" ? "Saving..." : "Add note"}
            </button>
          </form>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Follow-up and visit planning
          </h3>
          <form onSubmit={handleCreateFollowUp} className="space-y-2 rounded-xl bg-slate-50 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Schedule follow-up
            </h4>
            <input
              type="datetime-local"
              value={followUpDueAt}
              onChange={(event) => setFollowUpDueAt(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={!canManageFollowUps || loadingAction === "follow_up"}
              required
            />
            <select
              value={followUpAssigneeId}
              onChange={(event) => setFollowUpAssigneeId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={!canManageFollowUps || loadingAction === "follow_up"}
            >
              <option value="">Use current assignee</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role_key})
                </option>
              ))}
            </select>
            <textarea
              rows={2}
              value={followUpNote}
              onChange={(event) => setFollowUpNote(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Follow-up objective"
              disabled={!canManageFollowUps || loadingAction === "follow_up"}
            />
            <button
              type="submit"
              disabled={!canManageFollowUps || loadingAction === "follow_up"}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              {loadingAction === "follow_up" ? "Scheduling..." : "Create follow-up"}
            </button>
          </form>

          <form onSubmit={handleCreateSiteVisit} className="space-y-2 rounded-xl bg-slate-50 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Schedule site visit
            </h4>
            <input
              type="datetime-local"
              value={visitDate}
              onChange={(event) => setVisitDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={!canManageSiteVisits || loadingAction === "site_visit"}
              required
            />
            <select
              value={visitAssigneeId}
              onChange={(event) => setVisitAssigneeId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={!canManageSiteVisits || loadingAction === "site_visit"}
            >
              <option value="">Use current assignee</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role_key})
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={visitPickupRequired}
                onChange={(event) => setVisitPickupRequired(event.target.checked)}
                disabled={!canManageSiteVisits || loadingAction === "site_visit"}
              />
              Pickup required
            </label>
            <textarea
              rows={2}
              value={visitOutcomeNote}
              onChange={(event) => setVisitOutcomeNote(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Agenda or prep notes"
              disabled={!canManageSiteVisits || loadingAction === "site_visit"}
            />
            <button
              type="submit"
              disabled={!canManageSiteVisits || loadingAction === "site_visit"}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              {loadingAction === "site_visit" ? "Scheduling..." : "Create site visit"}
            </button>
          </form>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Deal capture</h3>
          <form onSubmit={handleCreateDeal} className="space-y-2">
            <select
              value={dealSalesUserId}
              onChange={(event) => setDealSalesUserId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={!canUpdateLead || loadingAction === "deal"}
            >
              <option value="">Use current assignee</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role_key})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={dealValue}
                onChange={(event) => setDealValue(event.target.value)}
                placeholder="Deal value"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!canUpdateLead || loadingAction === "deal"}
                required
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={bookingAmount}
                onChange={(event) => setBookingAmount(event.target.value)}
                placeholder="Booking amount"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!canUpdateLead || loadingAction === "deal"}
                required
              />
              <select
                value={dealStatus}
                onChange={(event) => setDealStatus(event.target.value as "booked" | "closed" | "lost")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                disabled={!canUpdateLead || loadingAction === "deal"}
              >
                <option value="booked">booked</option>
                <option value="closed">closed</option>
                <option value="lost">lost</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={!canUpdateLead || loadingAction === "deal"}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              {loadingAction === "deal" ? "Saving..." : "Create deal"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Deals</h3>
          <ul className="space-y-2">
            {deals.map((deal) => (
              <li key={deal.id} className="rounded-xl border border-slate-100 p-3 text-sm text-slate-700">
                <p className="font-medium text-slate-800">{deal.deal_status}</p>
                <p>Sales: {deal.sales_user_name ?? "Unknown"}</p>
                <p>Deal value: {Number(deal.deal_value).toLocaleString()}</p>
                <p>Booking amount: {Number(deal.booking_amount).toLocaleString()}</p>
                <p className="text-xs text-slate-500">{formatDateTime(deal.created_at)}</p>
              </li>
            ))}
            {deals.length === 0 ? <li className="text-sm text-slate-500">No deals yet.</li> : null}
          </ul>
        </div>
      </section>

      {actionError ? <p className="text-sm font-semibold text-red-600">{actionError}</p> : null}
      {actionMessage ? <p className="text-sm font-semibold text-emerald-600">{actionMessage}</p> : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Notes</h3>
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-xl border border-slate-100 p-3">
                <p className="text-sm text-slate-700">{note.note_text}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {note.author_name ?? "Unknown"} • {formatDateTime(note.created_at)}
                </p>
              </li>
            ))}
            {notes.length === 0 ? <li className="text-sm text-slate-500">No notes yet.</li> : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Follow-ups</h3>
          <ul className="space-y-3">
            {followUps.map((followUp) => (
              <li key={followUp.id} className="rounded-xl border border-slate-100 p-3">
                <p className="text-sm font-medium text-slate-800">{followUp.status}</p>
                <p className="text-xs text-slate-600">{formatDateTime(followUp.due_at)}</p>
                <p className="text-xs text-slate-600">{followUp.assignee_name ?? "Unassigned"}</p>
                {followUp.note ? <p className="mt-1 text-sm text-slate-700">{followUp.note}</p> : null}
              </li>
            ))}
            {followUps.length === 0 ? (
              <li className="text-sm text-slate-500">No follow-ups yet.</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Site visits</h3>
          <ul className="space-y-3">
            {siteVisits.map((visit) => (
              <li key={visit.id} className="rounded-xl border border-slate-100 p-3">
                <p className="text-sm font-medium text-slate-800">{visit.visit_status}</p>
                <p className="text-xs text-slate-600">{formatDateTime(visit.visit_date)}</p>
                <p className="text-xs text-slate-600">{visit.assignee_name ?? "Unassigned"}</p>
                {visit.outcome_note ? (
                  <p className="mt-1 text-sm text-slate-700">{visit.outcome_note}</p>
                ) : null}
              </li>
            ))}
            {siteVisits.length === 0 ? (
              <li className="text-sm text-slate-500">No site visits yet.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
