"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

type Company = {
  id: string;
  name: string;
  brand_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
  timezone: string;
  business_type: string;
  logo_url: string | null;
  status: string;
};

type LeadSource = {
  id: string;
  source_name: string;
  source_key: string;
  is_active: boolean;
  display_order: number;
};

type PipelineStage = {
  id: string;
  stage_key: string;
  stage_label: string;
  stage_order: number;
  stage_probability: number;
  is_active: boolean;
};

type SettingsClientProps = {
  company: Company | null;
  leadSources: LeadSource[];
  pipelineStages: PipelineStage[];
  companyId: string;
};

const TABS = [
  { id: "company", label: "Company Profile" },
  { id: "sources", label: "Lead Sources" },
  { id: "pipeline", label: "Pipeline Stages" }
] as const;

type Tab = (typeof TABS)[number]["id"];

// ─── Company Profile Tab ───────────────────────────────────────────────────
function CompanyProfileTab({ company }: { company: Company | null }) {
  const [form, setForm] = useState({
    name: company?.name ?? "",
    brand_name: company?.brand_name ?? "",
    phone: company?.phone ?? "",
    email: company?.email ?? "",
    website: company?.website ?? "",
    address: company?.address ?? "",
    city: company?.city ?? "",
    state: company?.state ?? "",
    pincode: company?.pincode ?? "",
    gst_number: company?.gst_number ?? "",
    timezone: company?.timezone ?? "Asia/Kolkata",
    business_type: company?.business_type ?? "real_estate"
  });
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function save() {
    startTransition(async () => {
      const res = await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) { toast("error", json.error ?? "Failed to save."); return; }
      toast("success", "Company profile updated.");
      router.refresh();
    });
  }

  const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors";
  const labelCls = "mb-1 block text-xs font-semibold text-slate-600";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Company Name *</label>
          <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Real Estate Co." />
        </div>
        <div>
          <label className={labelCls}>Brand Name</label>
          <input className={inputCls} value={form.brand_name} onChange={(e) => set("brand_name", e.target.value)} placeholder="Optional brand / trade name" />
        </div>
        <div>
          <label className={labelCls}>Company Phone</label>
          <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
        </div>
        <div>
          <label className={labelCls}>Company Email</label>
          <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@company.com" />
        </div>
        <div>
          <label className={labelCls}>Website</label>
          <input className={inputCls} value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://yourcompany.com" />
        </div>
        <div>
          <label className={labelCls}>GST Number</label>
          <input className={inputCls} value={form.gst_number} onChange={(e) => set("gst_number", e.target.value)} placeholder="22AAAAA0000A1Z5" />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Address</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Street Address</label>
            <input className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Building, Street" />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Mumbai" />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <input className={inputCls} value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="Maharashtra" />
          </div>
          <div>
            <label className={labelCls}>PIN Code</label>
            <input className={inputCls} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} placeholder="400001" />
          </div>
          <div>
            <label className={labelCls}>Timezone</label>
            <select className={inputCls} value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
              <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST +4)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 shadow-sm transition-colors"
        >
          {pending ? "Saving…" : "Save Company Profile"}
        </button>
      </div>
    </div>
  );
}

// ─── Lead Sources Tab ──────────────────────────────────────────────────────
function LeadSourcesTab({ sources }: { sources: LeadSource[] }) {
  const [list, setList] = useState(sources);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  async function toggle(id: string, is_active: boolean) {
    startTransition(async () => {
      const res = await fetch("/api/settings/lead-sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active })
      });
      if (!res.ok) { toast("error", "Failed to update source."); return; }
      setList((prev) => prev.map((s) => s.id === id ? { ...s, is_active } : s));
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Enable or disable the lead sources available when creating or importing leads.</p>
      <div className="divide-y divide-slate-100 rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        {list.map((src) => (
          <div key={src.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">{src.source_name}</p>
              <p className="text-xs text-text-muted font-mono">{src.source_key}</p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => toggle(src.id, !src.is_active)}
              className={`inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${src.is_active ? "bg-primary-600" : "bg-slate-200"}`}
              role="switch"
              aria-checked={src.is_active}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${src.is_active ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pipeline Stages Tab ───────────────────────────────────────────────────
function PipelineStagesTab({ stages }: { stages: PipelineStage[] }) {
  const [list, setList] = useState(stages);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editProb, setEditProb] = useState(0);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function startEdit(stage: PipelineStage) {
    setEditId(stage.id);
    setEditLabel(stage.stage_label);
    setEditProb(stage.stage_probability);
  }

  function saveEdit() {
    if (!editId) return;
    startTransition(async () => {
      const res = await fetch("/api/settings/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, stage_label: editLabel, stage_probability: editProb })
      });
      if (!res.ok) { toast("error", "Failed to update stage."); return; }
      setList((prev) => prev.map((s) => s.id === editId ? { ...s, stage_label: editLabel, stage_probability: editProb } : s));
      setEditId(null);
      toast("success", "Stage updated.");
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Customize stage labels and win probability percentages for your pipeline.</p>
      <div className="divide-y divide-slate-100 rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        {list.map((stage, idx) => (
          <div key={stage.id} className="flex items-center gap-4 px-4 py-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{idx + 1}</span>
            {editId === stage.id ? (
              <div className="flex flex-1 items-center gap-3">
                <input
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-primary-500"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-primary-500 text-center"
                    value={editProb}
                    onChange={(e) => setEditProb(Number(e.target.value))}
                  />
                  <span className="text-xs text-text-muted">%</span>
                </div>
                <button type="button" disabled={pending} onClick={saveEdit} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">Save</button>
                <button type="button" onClick={() => setEditId(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{stage.stage_label}</p>
                  <p className="text-xs text-text-muted font-mono">{stage.stage_key}</p>
                </div>
                <span className="text-xs text-text-muted">{stage.stage_probability}% prob.</span>
                <button type="button" onClick={() => startEdit(stage)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">Edit</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Client ───────────────────────────────────────────────────────────
export function SettingsClient({ company, leadSources, pipelineStages }: Omit<SettingsClientProps, "companyId">) {
  const [activeTab, setActiveTab] = useState<Tab>("company");

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1.5 shadow-card overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
        {activeTab === "company" && (
          <CompanyProfileTab company={company} />

        )}
        {activeTab === "sources" && (
          <LeadSourcesTab sources={leadSources} />
        )}
        {activeTab === "pipeline" && (
          <PipelineStagesTab stages={pipelineStages} />
        )}
      </div>
    </div>
  );
}
