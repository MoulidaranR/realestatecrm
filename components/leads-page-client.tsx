"use client";

import { useRouter } from "next/navigation";
import { CreateLeadForm } from "@/components/create-lead-form";
import { LeadsTable, type LeadTableItem } from "@/components/leads-table";
import type { UserProfile } from "@/lib/db-types";

type LeadsPageClientProps = {
  leads: LeadTableItem[];
  users: Array<Pick<UserProfile, "id" | "full_name" | "role_key" | "status">>;
  canCreate: boolean;
  canAssign: boolean;
};

export function LeadsPageClient({ leads, users, canCreate, canAssign }: LeadsPageClientProps) {
  const router = useRouter();

  return (
    <div className="space-y-5">
      {canCreate ? (
        <CreateLeadForm users={users} canAssign={canAssign} onCreated={() => router.refresh()} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          You have read-only lead access. Contact your company admin to enable lead creation.
        </div>
      )}
      <LeadsTable initialLeads={leads} />
    </div>
  );
}
