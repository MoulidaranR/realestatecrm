"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DuplicateHandling, ImportJob, ImportTemplate } from "@/lib/db-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

type ImportJobsClientProps = {
  jobs: ImportJob[];
  templates: ImportTemplate[];
};

const DUPLICATE_HANDLING_OPTIONS: DuplicateHandling[] = ["skip", "update_existing", "import_anyway", "manual_review"];

const DEFAULT_MAPPING = {
  full_name: "full_name",
  phone: "phone",
  alternate_phone: "alternate_phone",
  email: "email",
  city: "city",
  preferred_location: "preferred_location",
  budget_min: "budget_min",
  budget_max: "budget_max",
  property_type: "property_type",
  source: "source",
  notes_summary: "notes"
};

function fmt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function statusVariant(s: string): "success" | "danger" | "warning" | "info" | "default" {
  if (s === "completed") return "success";
  if (s === "failed") return "danger";
  if (s === "processing") return "warning";
  if (s === "pending") return "info";
  return "default";
}

const selectCls = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500";

export function ImportJobsClient({ jobs, templates }: ImportJobsClientProps) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mappingJson, setMappingJson] = useState(JSON.stringify(DEFAULT_MAPPING, null, 2));
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandling>("skip");
  const [templateName, setTemplateName] = useState("");
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const templateOptions = useMemo(
    () => templates.map((t) => ({ id: t.id, name: t.template_name, mapping: t.mapping_json })),
    [templates]
  );

  function applyTemplate(templateId: string) {
    const match = templateOptions.find((t) => t.id === templateId);
    if (!match) return;
    setMappingJson(JSON.stringify(match.mapping, null, 2));
    setTemplateName(match.name);
  }

  async function submitImport(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) { toast("error", "Please choose a CSV or XLSX file."); return; }
    setLoading(true);
    const formData = new FormData();
    formData.set("file", selectedFile);
    formData.set("mappingJson", mappingJson);
    formData.set("duplicateHandling", duplicateHandling);
    formData.set("saveTemplate", String(saveTemplate));
    formData.set("templateName", templateName);

    const res = await fetch("/api/import/jobs", { method: "POST", body: formData });
    const json = (await res.json()) as { error?: string; summary?: string };
    if (!res.ok) { toast("error", json.error ?? "Import failed"); setLoading(false); return; }
    toast("success", json.summary ?? "Import completed.");
    setSelectedFile(null);
    setShowForm(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-card">
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">{jobs.length}</strong> import job{jobs.length !== 1 ? "s" : ""}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
        >
          Import Leads
        </Button>
      </div>

      {/* Import form */}
      {showForm && (
        <form onSubmit={submitImport} className="rounded-xl border border-border bg-surface p-5 shadow-card space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-text-primary">Import Leads from CSV / XLSX</h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-disabled">File</label>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className={`block w-full ${selectCls}`}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-disabled">Duplicate Handling</label>
              <select value={duplicateHandling} onChange={(e) => setDuplicateHandling(e.target.value as DuplicateHandling)} className={`block w-full ${selectCls}`}>
                {DUPLICATE_HANDLING_OPTIONS.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-disabled">Saved Template</label>
              <select className={`block w-full ${selectCls}`} defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Select template</option>
                {templateOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-disabled">Mapping JSON</label>
            <textarea
              value={mappingJson}
              onChange={(e) => setMappingJson(e.target.value)}
              rows={8}
              className={`w-full font-mono text-xs ${selectCls}`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary cursor-pointer">
              <input type="checkbox" checked={saveTemplate} onChange={(e) => setSaveTemplate(e.target.checked)} className="accent-primary-600" />
              Save as template
            </label>
            {saveTemplate && (
              <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" className={selectCls} required />
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" type="submit" loading={loading}>Run Import</Button>
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Import history table */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-text-primary">Import History</h3>
        </div>
        <div className="table-container scrollbar-thin">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {["File", "Type", "Status", "Rows", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState compact title="No imports yet" description="Upload your first CSV or XLSX file to import leads." />
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{job.file_name}</td>
                    <td className="px-4 py-3"><Badge variant="default">{job.file_type}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={statusVariant(job.status)} dot>{job.status}</Badge></td>
                    <td className="px-4 py-3 text-text-secondary">
                      <span className="font-semibold text-success-700">{job.success_rows}</span>
                      <span className="text-text-muted"> / {job.total_rows}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">{fmt(job.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
