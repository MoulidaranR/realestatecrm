"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DuplicateHandling, ImportJob, ImportTemplate } from "@/lib/db-types";

type ImportJobsClientProps = {
  jobs: ImportJob[];
  templates: ImportTemplate[];
};

const DUPLICATE_HANDLING_OPTIONS: DuplicateHandling[] = [
  "skip",
  "update_existing",
  "import_anyway",
  "manual_review"
];

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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "-";
  }
  return date.toLocaleString();
}

export function ImportJobsClient({ jobs, templates }: ImportJobsClientProps) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mappingJson, setMappingJson] = useState(JSON.stringify(DEFAULT_MAPPING, null, 2));
  const [duplicateHandling, setDuplicateHandling] = useState<DuplicateHandling>("skip");
  const [templateName, setTemplateName] = useState("");
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const templateOptions = useMemo(
    () =>
      templates.map((template) => ({
        id: template.id,
        name: template.template_name,
        mapping: template.mapping_json
      })),
    [templates]
  );

  function applyTemplate(templateId: string) {
    const match = templateOptions.find((template) => template.id === templateId);
    if (!match) {
      return;
    }
    setMappingJson(JSON.stringify(match.mapping, null, 2));
    setTemplateName(match.name);
  }

  async function submitImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedFile) {
      setError("Please choose a CSV or XLSX file.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.set("file", selectedFile);
    formData.set("mappingJson", mappingJson);
    formData.set("duplicateHandling", duplicateHandling);
    formData.set("saveTemplate", String(saveTemplate));
    formData.set("templateName", templateName);

    const response = await fetch("/api/import/jobs", {
      method: "POST",
      body: formData
    });

    const payload = (await response.json()) as { error?: string; summary?: string };
    if (!response.ok) {
      setError(payload.error ?? "Import failed");
      setLoading(false);
      return;
    }

    setSuccess(payload.summary ?? "Import completed.");
    setSelectedFile(null);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={submitImport}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Import leads</h3>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              File
            </label>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Duplicate handling
            </label>
            <select
              value={duplicateHandling}
              onChange={(event) => setDuplicateHandling(event.target.value as DuplicateHandling)}
              className="block w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            >
              {DUPLICATE_HANDLING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Use saved template
            </label>
            <select
              className="block w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
              defaultValue=""
              onChange={(event) => applyTemplate(event.target.value)}
            >
              <option value="">Select template</option>
              {templateOptions.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mapping JSON (destination_field: source_header)
          </label>
          <textarea
            value={mappingJson}
            onChange={(event) => setMappingJson(event.target.value)}
            rows={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={saveTemplate}
              onChange={(event) => setSaveTemplate(event.target.checked)}
            />
            Save as template
          </label>
          {saveTemplate ? (
            <input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Template name"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Importing..." : "Run import"}
          </button>
          {error ? <span className="text-xs font-semibold text-red-600">{error}</span> : null}
          {success ? <span className="text-xs font-semibold text-emerald-600">{success}</span> : null}
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rows</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{job.file_name}</td>
                <td className="px-4 py-3 text-slate-700">{job.file_type}</td>
                <td className="px-4 py-3 text-slate-700">{job.status}</td>
                <td className="px-4 py-3 text-slate-700">
                  {job.success_rows}/{job.total_rows} success
                </td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(job.created_at)}</td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                  No imports yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
