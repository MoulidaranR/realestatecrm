import type { Deal, FollowUp, Lead, SiteVisit } from "@/lib/db-types";

export type ReportSummary = {
  totalLeads: number;
  openLeads: number;
  hotLeads: number;
  conversionRate: number;
  pendingFollowUps: number;
  overdueFollowUps: number;
  siteVisitsScheduled: number;
  siteVisitsCompleted: number;
  totalDeals: number;
  totalDealValue: number;
};

export function buildReportSummary(
  leads: Lead[],
  followUps: FollowUp[],
  siteVisits: SiteVisit[],
  deals: Deal[]
): ReportSummary {
  const now = new Date();
  const totalLeads = leads.length;
  const openLeads = leads.filter((lead) => lead.lead_status === "open").length;
  const hotLeads = leads.filter((lead) => lead.score_bucket === "hot").length;
  const bookedLeads = leads.filter((lead) => lead.pipeline_stage === "booked").length;
  const conversionRate = totalLeads > 0 ? Number(((bookedLeads / totalLeads) * 100).toFixed(2)) : 0;
  const pendingFollowUps = followUps.filter((followUp) => followUp.status === "pending").length;
  const overdueFollowUps = followUps.filter((followUp) => {
    if (followUp.status !== "pending") {
      return false;
    }
    const dueDate = new Date(followUp.due_at);
    return !Number.isNaN(dueDate.valueOf()) && dueDate < now;
  }).length;
  const siteVisitsScheduled = siteVisits.filter((visit) =>
    ["scheduled", "rescheduled"].includes(visit.visit_status)
  ).length;
  const siteVisitsCompleted = siteVisits.filter((visit) => visit.visit_status === "completed").length;
  const totalDeals = deals.length;
  const totalDealValue = deals.reduce((sum, deal) => sum + Number(deal.deal_value ?? 0), 0);

  return {
    totalLeads,
    openLeads,
    hotLeads,
    conversionRate,
    pendingFollowUps,
    overdueFollowUps,
    siteVisitsScheduled,
    siteVisitsCompleted,
    totalDeals,
    totalDealValue
  };
}

export function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const escapeValue = (value: string | number): string => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeValue(row[header] ?? "")).join(","))
  ];
  return lines.join("\n");
}
