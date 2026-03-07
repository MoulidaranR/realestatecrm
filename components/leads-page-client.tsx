"use client";

import { useRouter } from "next/navigation";
import { CreateLeadForm } from "@/components/create-lead-form";
import { LeadsTable, type LeadTableItem } from "@/components/leads-table";

type LeadsPageClientProps = {
  leads: LeadTableItem[];
};

export function LeadsPageClient({ leads }: LeadsPageClientProps) {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <CreateLeadForm onCreated={() => router.refresh()} />
      <LeadsTable initialLeads={leads} />
    </div>
  );
}
