import { ImportJobsClient } from "@/components/import-jobs-client";
import type { ImportJob, ImportTemplate } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ImportsPage() {
  const actor = await getActorContext();
  await requirePermission(actor, "import.manage");

  const supabase = await createServerSupabaseClient();
  const [{ data: jobs }, { data: templates }] = await Promise.all([
    supabase
      .from("import_jobs")
      .select("*")
      .eq("company_id", actor.profile.company_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("import_templates")
      .select("*")
      .eq("company_id", actor.profile.company_id)
      .order("created_at", { ascending: false })
      .limit(50)
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Imports</h1>
        <p className="text-sm text-slate-500">
          CSV/XLSX upload with mapping, duplicate handling, and import history.
        </p>
      </div>
      <ImportJobsClient
        jobs={(jobs ?? []) as ImportJob[]}
        templates={(templates ?? []) as ImportTemplate[]}
      />
    </div>
  );
}
