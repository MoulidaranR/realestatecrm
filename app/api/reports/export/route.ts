import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import type { Deal, FollowUp, Lead, SiteVisit, UserProfile } from "@/lib/db-types";
import { buildReportSummary, toCsv } from "@/lib/reporting";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

function toIsoRange(from: string, to: string): { fromIso: string; toIso: string } {
  return {
    fromIso: `${from}T00:00:00.000Z`,
    toIso: `${to}T23:59:59.999Z`
  };
}

export async function GET(request: Request) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "reports.export");
    const url = new URL(request.url);

    const now = new Date();
    const defaultFromDate = new Date(now);
    defaultFromDate.setDate(defaultFromDate.getDate() - 30);
    const from = url.searchParams.get("from")?.trim() || defaultFromDate.toISOString().slice(0, 10);
    const to = url.searchParams.get("to")?.trim() || now.toISOString().slice(0, 10);
    const format = (url.searchParams.get("format")?.trim().toLowerCase() || "csv") as
      | "csv"
      | "xlsx";
    const { fromIso, toIso } = toIsoRange(from, to);

    const supabase = await createServerSupabaseClient();
    const [{ data: leads }, { data: followUps }, { data: siteVisits }, { data: deals }, { data: users }] =
      await Promise.all([
        supabase
          .from("leads")
          .select("id, source, source_platform, city, pipeline_stage, lead_status, score_bucket, lead_priority, assigned_to, created_at")
          .eq("company_id", actor.profile.company_id)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .limit(10000),
        supabase
          .from("follow_ups")
          .select("id, lead_id, assigned_user_id, status, due_at, created_at, completed_at")
          .eq("company_id", actor.profile.company_id)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .limit(10000),
        supabase
          .from("site_visits")
          .select("id, assigned_sales_user_id, visit_status, visit_date, created_at")
          .eq("company_id", actor.profile.company_id)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .limit(10000),
        supabase
          .from("deals")
          .select("id, lead_id, deal_status, deal_value, created_at")
          .eq("company_id", actor.profile.company_id)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .limit(10000),
        supabase
          .from("user_profiles")
          .select("id, full_name")
          .eq("company_id", actor.profile.company_id)
      ]);

    const summary = buildReportSummary(
      (leads ?? []) as Lead[],
      (followUps ?? []) as FollowUp[],
      (siteVisits ?? []) as SiteVisit[],
      (deals ?? []) as Deal[],
      (users ?? []) as Array<Pick<UserProfile, "id" | "full_name">>
    );

    const summaryRows = [
      { metric: "period_from", value: from },
      { metric: "period_to", value: to },
      { metric: "total_leads", value: summary.totalLeads },
      { metric: "open_leads", value: summary.openLeads },
      { metric: "hot_leads", value: summary.hotLeads },
      { metric: "conversion_rate_percent", value: summary.conversionRate },
      { metric: "pending_followups", value: summary.pendingFollowUps },
      { metric: "followup_completion_rate_percent", value: summary.followUpCompletionRate },
      { metric: "overdue_followups", value: summary.overdueFollowUps },
      { metric: "scheduled_site_visits", value: summary.siteVisitsScheduled },
      { metric: "completed_site_visits", value: summary.siteVisitsCompleted },
      { metric: "no_show_site_visits", value: summary.siteVisitsNoShow },
      { metric: "cancelled_site_visits", value: summary.siteVisitsCancelled },
      { metric: "won_deals", value: summary.wonDeals },
      { metric: "total_deals", value: summary.totalDeals },
      { metric: "total_deal_value", value: summary.totalDealValue },
      { metric: "avg_response_hours", value: summary.avgResponseHours }
    ];

    const detailRows = [
      ...summary.sourceCounts.map((item) => ({
        section: "leads_by_source",
        label: item.key,
        value: item.count
      })),
      ...summary.cityCounts.map((item) => ({
        section: "leads_by_city",
        label: item.key,
        value: item.count
      })),
      ...summary.stageCounts.map((item) => ({
        section: "leads_by_stage",
        label: item.key,
        value: item.count
      })),
      ...summary.leadAgingBuckets.map((item) => ({
        section: "lead_aging_buckets",
        label: item.key,
        value: item.count
      })),
      ...summary.potentialConversion.map((item) => ({
        section: "potential_conversion_percent",
        label: item.key,
        value: item.count
      }))
    ];

    const assigneeRows = summary.assigneePerformance.map((item) => ({
      user_id: item.userId,
      name: item.name,
      leads: item.leads,
      followups_completed: item.followUpsCompleted,
      visits_completed: item.visitsCompleted,
      conversions: item.conversions
    }));

    const admin = createAdminSupabaseClient();
    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "report",
      action: "report.exported",
      description: `Report exported (${format}) for ${from} to ${to}`,
      metadata: {
        from,
        to,
        format
      }
    });

    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Summary");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), "Breakdowns");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(assigneeRows), "Assignees");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": "attachment; filename=reports-summary.xlsx"
        }
      });
    }

    const csv = toCsv([
      ...summaryRows,
      ...detailRows.map((row) => ({
        metric: `${row.section}:${row.label}`,
        value: row.value
      })),
      ...assigneeRows.map((row) => ({
        metric: `assignee:${row.name}:conversions`,
        value: row.conversions
      }))
    ]);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=reports-summary.csv"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
