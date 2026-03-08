import { redirect } from "next/navigation";
import { getActorContext } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsClient } from "@/components/settings-client";

export default async function SettingsPage() {
  const actor = await getActorContext();
  if (actor.profile.role_key !== "company_admin") {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: company }, { data: leadSources }, { data: pipelineStages }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, brand_name, phone, email, website, address, city, state, pincode, gst_number, timezone, business_type, logo_url, status")
      .eq("id", actor.profile.company_id)
      .single(),
    supabase
      .from("lead_sources")
      .select("id, source_name, source_key, is_active, display_order")
      .eq("company_id", actor.profile.company_id)
      .order("display_order", { ascending: true }),
    supabase
      .from("pipeline_stage_config")
      .select("id, stage_key, stage_label, stage_order, stage_probability, is_active")
      .eq("company_id", actor.profile.company_id)
      .order("stage_order", { ascending: true })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your company profile, lead sources, pipeline, and system preferences."
        breadcrumbs={[{ label: "System" }, { label: "Settings" }]}
      />
      <SettingsClient
        company={company}
        leadSources={leadSources ?? []}
        pipelineStages={pipelineStages ?? []}
      />

    </div>
  );
}
