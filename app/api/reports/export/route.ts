import { NextResponse } from "next/server";
import type { Deal, FollowUp, Lead, SiteVisit } from "@/lib/db-types";
import { buildReportSummary, toCsv } from "@/lib/reporting";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
    const fromIso = `${from}T00:00:00.000Z`;
    const toIso = `${to}T23:59:59.999Z`;

    const supabase = await createServerSupabaseClient();
    const [{ data: leads }, { data: followUps }, { data: siteVisits }, { data: deals }] = await Promise.all([
      supabase
        .from("leads")
        .select("source, pipeline_stage, lead_status, score_bucket, created_at")
        .eq("company_id", actor.profile.company_id)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(5000),
      supabase
        .from("follow_ups")
        .select("status, due_at")
        .eq("company_id", actor.profile.company_id)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(5000),
      supabase
        .from("site_visits")
        .select("visit_status")
        .eq("company_id", actor.profile.company_id)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(5000),
      supabase
        .from("deals")
        .select("deal_value")
        .eq("company_id", actor.profile.company_id)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(5000)
    ]);

    const summary = buildReportSummary(
      (leads ?? []) as Lead[],
      (followUps ?? []) as FollowUp[],
      (siteVisits ?? []) as SiteVisit[],
      (deals ?? []) as Deal[]
    );

    const csv = toCsv([
      { metric: "period_from", value: from },
      { metric: "period_to", value: to },
      { metric: "total_leads", value: summary.totalLeads },
      { metric: "open_leads", value: summary.openLeads },
      { metric: "hot_leads", value: summary.hotLeads },
      { metric: "conversion_rate_percent", value: summary.conversionRate },
      { metric: "pending_followups", value: summary.pendingFollowUps },
      { metric: "overdue_followups", value: summary.overdueFollowUps },
      { metric: "scheduled_site_visits", value: summary.siteVisitsScheduled },
      { metric: "completed_site_visits", value: summary.siteVisitsCompleted },
      { metric: "total_deals", value: summary.totalDeals },
      { metric: "total_deal_value", value: summary.totalDealValue }
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
