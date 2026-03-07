"use client";

import { useState } from "react";

type CreateLeadFormProps = {
  onCreated: () => void;
};

export function CreateLeadForm({ onCreated }: CreateLeadFormProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [source, setSource] = useState("manual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fullName,
        phone,
        city,
        preferredLocation,
        source
      })
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to create lead");
      setLoading(false);
      return;
    }

    setSuccess("Lead created");
    setFullName("");
    setPhone("");
    setCity("");
    setPreferredLocation("");
    setSource("manual");
    setLoading(false);
    onCreated();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Create lead</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <input
          placeholder="Full name"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <input
          placeholder="Phone"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
        <input
          placeholder="City"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
        <input
          placeholder="Preferred location"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
          value={preferredLocation}
          onChange={(event) => setPreferredLocation(event.target.value)}
        />
        <input
          placeholder="Source (manual, campaign...)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          required
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={loading}
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create lead"}
        </button>
        {error ? <span className="text-xs font-semibold text-red-600">{error}</span> : null}
        {success ? (
          <span className="text-xs font-semibold text-emerald-600">{success}</span>
        ) : null}
      </div>
    </form>
  );
}
