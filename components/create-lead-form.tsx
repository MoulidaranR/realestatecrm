"use client";

import { useMemo, useState } from "react";
import type { UserProfile } from "@/lib/db-types";
import {
  LEAD_PRIORITIES,
  PIPELINE_STAGES,
  SOURCE_PLATFORMS,
  formatStageLabel
} from "@/lib/lead-options";

type CreateLeadFormProps = {
  users: Array<Pick<UserProfile, "id" | "full_name" | "role_key" | "status">>;
  canAssign: boolean;
  onCreated: () => void;
};

const LEAD_STATUSES = ["open", "cold", "won", "lost"] as const;
const BUYING_PURPOSES = ["self_use", "investment"] as const;

type FormState = {
  fullName: string;
  primaryPhone: string;
  alternatePhone: string;
  email: string;
  city: string;
  preferredLocation: string;
  propertyType: string;
  budgetMin: string;
  budgetMax: string;
  buyingPurpose: string;
  sourcePlatform: string;
  sourceCampaign: string;
  capturedByUserId: string;
  assignedToUserId: string;
  leadPriority: string;
  score: string;
  status: string;
  stage: string;
  bhkPreference: string;
  possessionTimeline: string;
  financingNeeded: boolean;
  loanStatus: string;
  siteVisitInterest: boolean;
  nextFollowupAt: string;
  notes: string;
  occupation: string;
  companyName: string;
  familySize: string;
  preferredContactTime: string;
  tags: string;
  requirementsSummary: string;
};

function defaultState(defaultUserId: string): FormState {
  return {
    fullName: "",
    primaryPhone: "",
    alternatePhone: "",
    email: "",
    city: "",
    preferredLocation: "",
    propertyType: "",
    budgetMin: "",
    budgetMax: "",
    buyingPurpose: "self_use",
    sourcePlatform: "manual",
    sourceCampaign: "",
    capturedByUserId: defaultUserId,
    assignedToUserId: defaultUserId,
    leadPriority: "warm",
    score: "35",
    status: "open",
    stage: "new",
    bhkPreference: "",
    possessionTimeline: "",
    financingNeeded: false,
    loanStatus: "",
    siteVisitInterest: false,
    nextFollowupAt: "",
    notes: "",
    occupation: "",
    companyName: "",
    familySize: "",
    preferredContactTime: "",
    tags: "",
    requirementsSummary: ""
  };
}

export function CreateLeadForm({ users, canAssign, onCreated }: CreateLeadFormProps) {
  const defaultUserId = users[0]?.id ?? "";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => defaultState(defaultUserId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const userOptions = useMemo(() => users.filter((item) => item.status === "active"), [users]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): string | null {
    if (!form.fullName.trim()) {
      return "Full name is required";
    }
    if (!form.primaryPhone.trim()) {
      return "Primary phone is required";
    }
    const budgetMin = form.budgetMin ? Number(form.budgetMin) : null;
    const budgetMax = form.budgetMax ? Number(form.budgetMax) : null;
    if (budgetMin !== null && (!Number.isFinite(budgetMin) || budgetMin < 0)) {
      return "Budget min must be a valid non-negative number";
    }
    if (budgetMax !== null && (!Number.isFinite(budgetMax) || budgetMax < 0)) {
      return "Budget max must be a valid non-negative number";
    }
    if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
      return "Budget min cannot exceed budget max";
    }
    const score = Number(form.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return "Score must be between 0 and 100";
    }
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        budgetMin: form.budgetMin ? Number(form.budgetMin) : null,
        budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
        familySize: form.familySize ? Number(form.familySize) : null,
        score: Number(form.score)
      })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to create lead");
      setLoading(false);
      return;
    }

    setSuccess("Lead created successfully.");
    setForm(defaultState(defaultUserId));
    setLoading(false);
    setOpen(false);
    onCreated();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Lead Capture</h3>
          <p className="text-xs text-slate-500">Create qualified real estate leads with assignment and follow-up setup.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          {open ? "Close Form" : "Create Lead"}
        </button>
      </div>

      {success ? <p className="mt-3 text-sm font-semibold text-emerald-600">{success}</p> : null}

      {open ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Contact Details</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                placeholder="Full name *"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.fullName}
                onChange={(event) => setField("fullName", event.target.value)}
                required
              />
              <input
                placeholder="Primary phone *"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.primaryPhone}
                onChange={(event) => setField("primaryPhone", event.target.value)}
                required
              />
              <input
                placeholder="Alternate phone"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.alternatePhone}
                onChange={(event) => setField("alternatePhone", event.target.value)}
              />
              <input
                type="email"
                placeholder="Email"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
              />
              <input
                placeholder="City"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.city}
                onChange={(event) => setField("city", event.target.value)}
              />
              <input
                placeholder="Preferred location"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.preferredLocation}
                onChange={(event) => setField("preferredLocation", event.target.value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Property Requirements</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                placeholder="Property type"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.propertyType}
                onChange={(event) => setField("propertyType", event.target.value)}
              />
              <input
                placeholder="BHK preference"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.bhkPreference}
                onChange={(event) => setField("bhkPreference", event.target.value)}
              />
              <input
                placeholder="Possession timeline"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.possessionTimeline}
                onChange={(event) => setField("possessionTimeline", event.target.value)}
              />
              <input
                type="number"
                min="0"
                placeholder="Budget min"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.budgetMin}
                onChange={(event) => setField("budgetMin", event.target.value)}
              />
              <input
                type="number"
                min="0"
                placeholder="Budget max"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.budgetMax}
                onChange={(event) => setField("budgetMax", event.target.value)}
              />
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.buyingPurpose}
                onChange={(event) => setField("buyingPurpose", event.target.value)}
              >
                {BUYING_PURPOSES.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {purpose}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Source & Assignment</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.sourcePlatform}
                onChange={(event) => setField("sourcePlatform", event.target.value)}
              >
                {SOURCE_PLATFORMS.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
              <input
                placeholder="Source campaign"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.sourceCampaign}
                onChange={(event) => setField("sourceCampaign", event.target.value)}
              />
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.capturedByUserId}
                onChange={(event) => setField("capturedByUserId", event.target.value)}
              >
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    Captured by: {user.full_name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.assignedToUserId}
                onChange={(event) => setField("assignedToUserId", event.target.value)}
                disabled={!canAssign}
              >
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    Assigned to: {user.full_name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Qualification</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.leadPriority}
                onChange={(event) => setField("leadPriority", event.target.value)}
              >
                {LEAD_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    Priority: {priority}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="Score (0-100)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.score}
                onChange={(event) => setField("score", event.target.value)}
              />
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.status}
                onChange={(event) => setField("status", event.target.value)}
              >
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    Status: {status}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.stage}
                onChange={(event) => setField("stage", event.target.value)}
              >
                {PIPELINE_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    Stage: {formatStageLabel(stage)}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={form.financingNeeded}
                  onChange={(event) => setField("financingNeeded", event.target.checked)}
                />
                Financing needed
              </label>
              <input
                placeholder="Loan status"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.loanStatus}
                onChange={(event) => setField("loanStatus", event.target.value)}
              />
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={form.siteVisitInterest}
                  onChange={(event) => setField("siteVisitInterest", event.target.checked)}
                />
                Interested in site visit
              </label>
              <input
                type="datetime-local"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.nextFollowupAt}
                onChange={(event) => setField("nextFollowupAt", event.target.value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">Notes & Additional Context</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                placeholder="Occupation"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.occupation}
                onChange={(event) => setField("occupation", event.target.value)}
              />
              <input
                placeholder="Company name"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.companyName}
                onChange={(event) => setField("companyName", event.target.value)}
              />
              <input
                type="number"
                min="1"
                placeholder="Family size"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.familySize}
                onChange={(event) => setField("familySize", event.target.value)}
              />
              <input
                placeholder="Preferred contact time"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.preferredContactTime}
                onChange={(event) => setField("preferredContactTime", event.target.value)}
              />
              <input
                placeholder="Tags (comma separated)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.tags}
                onChange={(event) => setField("tags", event.target.value)}
              />
              <input
                placeholder="Requirements summary"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.requirementsSummary}
                onChange={(event) => setField("requirementsSummary", event.target.value)}
              />
            </div>
            <textarea
              rows={3}
              placeholder="Notes / remarks"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
            />
          </section>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          <div className="flex items-center gap-3">
            <button
              disabled={loading}
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Lead"}
            </button>
            <button
              type="button"
              onClick={() => setForm(defaultState(defaultUserId))}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Reset
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
