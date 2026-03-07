import { NextResponse } from "next/server";
import type { DuplicateHandling } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import { parseImportFile } from "@/lib/import-parser";
import { refreshLeadAutomation } from "@/lib/lead-automation";

const DUPLICATE_OPTIONS: DuplicateHandling[] = [
  "skip",
  "update_existing",
  "import_anyway",
  "manual_review"
];

export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "import.manage");

    const formData = await request.formData();
    const file = formData.get("file");
    const mappingJson = String(formData.get("mappingJson") ?? "{}");
    const duplicateHandlingValue = String(formData.get("duplicateHandling") ?? "skip");
    const saveTemplate = String(formData.get("saveTemplate") ?? "false") === "true";
    const templateName = String(formData.get("templateName") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const duplicateHandling = DUPLICATE_OPTIONS.includes(duplicateHandlingValue as DuplicateHandling)
      ? (duplicateHandlingValue as DuplicateHandling)
      : "skip";
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "xlsx") {
      return NextResponse.json(
        { error: "Only CSV and XLSX files are supported" },
        { status: 400 }
      );
    }

    let mapping: Record<string, string>;
    try {
      mapping = JSON.parse(mappingJson) as Record<string, string>;
    } catch {
      return NextResponse.json({ error: "Invalid mapping JSON" }, { status: 400 });
    }
    if (Object.keys(mapping).length === 0) {
      return NextResponse.json({ error: "Mapping cannot be empty" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: createdJob, error: jobCreateError } = await admin
      .from("import_jobs")
      .insert({
        company_id: actor.profile.company_id,
        uploaded_by: actor.profile.id,
        file_name: file.name,
        file_type: extension,
        mapping_json: mapping,
        duplicate_handling: duplicateHandling,
        status: "processing"
      })
      .select("id")
      .single();
    if (jobCreateError || !createdJob) {
      return NextResponse.json({ error: jobCreateError?.message ?? "Failed to create import job" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const parsedRows = parseImportFile(file.name, fileBuffer, mapping);

    const phones = Array.from(
      new Set(
        parsedRows
          .map((row) => row.parsed.phone?.trim())
          .filter((phone): phone is string => Boolean(phone))
      )
    );

    const { data: existingLeads } = phones.length
      ? await admin
          .from("leads")
          .select("id, phone")
          .eq("company_id", actor.profile.company_id)
          .in("phone", phones)
      : { data: [] as Array<{ id: string; phone: string }> };
    const leadByPhone = new Map((existingLeads ?? []).map((lead) => [lead.phone, lead.id]));

    let successRows = 0;
    let failedRows = 0;
    const rowLogs: Array<{
      import_job_id: string;
      raw_data_json: Record<string, unknown>;
      parsed_data_json: Record<string, unknown>;
      row_status: "success" | "failed" | "duplicate";
      error_message: string | null;
    }> = [];

    for (const row of parsedRows) {
      if (row.errors.length > 0) {
        failedRows += 1;
        rowLogs.push({
          import_job_id: createdJob.id,
          raw_data_json: row.raw,
          parsed_data_json: row.parsed as Record<string, unknown>,
          row_status: "failed",
          error_message: row.errors.join("; ")
        });
        continue;
      }

      const phone = row.parsed.phone?.trim() ?? "";
      const existingLeadId = leadByPhone.get(phone);

      if (existingLeadId && duplicateHandling === "skip") {
        failedRows += 1;
        rowLogs.push({
          import_job_id: createdJob.id,
          raw_data_json: row.raw,
          parsed_data_json: row.parsed as Record<string, unknown>,
          row_status: "duplicate",
          error_message: "Duplicate phone found; row skipped"
        });
        continue;
      }

      if (existingLeadId && duplicateHandling === "manual_review") {
        failedRows += 1;
        rowLogs.push({
          import_job_id: createdJob.id,
          raw_data_json: row.raw,
          parsed_data_json: row.parsed as Record<string, unknown>,
          row_status: "duplicate",
          error_message: "Duplicate detected; manual review required"
        });
        continue;
      }

      try {
        if (existingLeadId && duplicateHandling === "update_existing") {
          const { error: updateError } = await admin
            .from("leads")
            .update({
              full_name: row.parsed.full_name,
              alternate_phone: row.parsed.alternate_phone ?? null,
              email: row.parsed.email ?? null,
              city: row.parsed.city ?? null,
              preferred_location: row.parsed.preferred_location ?? null,
              budget_min: row.parsed.budget_min ?? null,
              budget_max: row.parsed.budget_max ?? null,
              property_type: row.parsed.property_type ?? null,
              source: row.parsed.source ?? "import",
              notes_summary: row.parsed.notes_summary ?? null,
              updated_at: new Date().toISOString()
            })
            .eq("id", existingLeadId)
            .eq("company_id", actor.profile.company_id);

          if (updateError) {
            throw new Error(updateError.message);
          }
          await refreshLeadAutomation(admin, existingLeadId, actor.profile.company_id);
          successRows += 1;
          rowLogs.push({
            import_job_id: createdJob.id,
            raw_data_json: row.raw,
            parsed_data_json: row.parsed as Record<string, unknown>,
            row_status: "success",
            error_message: null
          });
          continue;
        }

        const { data: createdLead, error: insertError } = await admin
          .from("leads")
          .insert({
            company_id: actor.profile.company_id,
            created_by: actor.profile.id,
            assigned_to: null,
            full_name: row.parsed.full_name,
            phone: row.parsed.phone,
            alternate_phone: row.parsed.alternate_phone ?? null,
            email: row.parsed.email ?? null,
            city: row.parsed.city ?? null,
            preferred_location: row.parsed.preferred_location ?? null,
            budget_min: row.parsed.budget_min ?? null,
            budget_max: row.parsed.budget_max ?? null,
            property_type: row.parsed.property_type ?? null,
            source: row.parsed.source ?? "import",
            notes_summary: row.parsed.notes_summary ?? null,
            pipeline_stage: "new",
            lead_status: "open"
          })
          .select("id")
          .single();

        if (insertError || !createdLead) {
          throw new Error(insertError?.message ?? "Failed to import lead");
        }

        await refreshLeadAutomation(admin, createdLead.id, actor.profile.company_id);
        successRows += 1;
        rowLogs.push({
          import_job_id: createdJob.id,
          raw_data_json: row.raw,
          parsed_data_json: row.parsed as Record<string, unknown>,
          row_status: "success",
          error_message: null
        });
      } catch (error) {
        failedRows += 1;
        rowLogs.push({
          import_job_id: createdJob.id,
          raw_data_json: row.raw,
          parsed_data_json: row.parsed as Record<string, unknown>,
          row_status: "failed",
          error_message: error instanceof Error ? error.message : "Import row failed"
        });
      }
    }

    if (rowLogs.length > 0) {
      await admin.from("import_rows").insert(rowLogs);
    }

    if (saveTemplate && templateName) {
      await admin.from("import_templates").upsert(
        {
          company_id: actor.profile.company_id,
          created_by: actor.profile.id,
          template_name: templateName,
          mapping_json: mapping
        },
        { onConflict: "company_id,template_name" }
      );
    }

    const finalStatus = failedRows > 0 && successRows === 0 ? "failed" : "completed";
    await admin
      .from("import_jobs")
      .update({
        status: finalStatus,
        total_rows: parsedRows.length,
        success_rows: successRows,
        failed_rows: failedRows,
        completed_at: new Date().toISOString()
      })
      .eq("id", createdJob.id);

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "import_job",
      entityId: createdJob.id,
      action: "import.completed",
      description: `Import completed for ${file.name}`,
      metadata: {
        totalRows: parsedRows.length,
        successRows,
        failedRows,
        duplicateHandling
      }
    });

    await createNotification(admin, {
      companyId: actor.profile.company_id,
      userProfileId: actor.profile.id,
      eventType: "import.completed",
      title: "Import completed",
      message: `${file.name}: ${successRows} success, ${failedRows} failed`
    });

    return NextResponse.json({
      success: true,
      summary: `Import finished. ${successRows} success, ${failedRows} failed.`,
      jobId: createdJob.id
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
