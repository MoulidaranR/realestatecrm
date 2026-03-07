import type { Deal, FollowUp, Lead, SiteVisit, UserProfile } from "@/lib/db-types";

type CountItem = {
  key: string;
  count: number;
};

type AssigneePerformanceItem = {
  userId: string;
  name: string;
  leads: number;
  followUpsCompleted: number;
  visitsCompleted: number;
  conversions: number;
};

export type ReportSummary = {
  totalLeads: number;
  openLeads: number;
  hotLeads: number;
  conversionRate: number;
  pendingFollowUps: number;
  overdueFollowUps: number;
  followUpCompletionRate: number;
  siteVisitsScheduled: number;
  siteVisitsCompleted: number;
  siteVisitsNoShow: number;
  siteVisitsCancelled: number;
  totalDeals: number;
  totalDealValue: number;
  wonDeals: number;
  avgResponseHours: number;
  sourceCounts: CountItem[];
  cityCounts: CountItem[];
  stageCounts: CountItem[];
  assigneeCounts: CountItem[];
  leadAgingBuckets: CountItem[];
  potentialConversion: CountItem[];
  assigneePerformance: AssigneePerformanceItem[];
};

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function mapToSortedCounts(map: Map<string, number>): CountItem[] {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildReportSummary(
  leads: Lead[],
  followUps: FollowUp[],
  siteVisits: SiteVisit[],
  deals: Deal[],
  users: Array<Pick<UserProfile, "id" | "full_name">> = []
): ReportSummary {
  const now = new Date();
  const totalLeads = leads.length;
  const openLeads = leads.filter((lead) => lead.lead_status === "open").length;
  const hotLeads = leads.filter((lead) => lead.lead_priority === "hot" || lead.score_bucket === "hot").length;
  const wonLeads = leads.filter(
    (lead) => lead.lead_status === "won" || lead.pipeline_stage === "booked"
  ).length;
  const conversionRate = totalLeads > 0 ? Number(((wonLeads / totalLeads) * 100).toFixed(2)) : 0;

  const pendingFollowUps = followUps.filter((followUp) => followUp.status === "pending").length;
  const completedFollowUps = followUps.filter((followUp) => followUp.status === "completed").length;
  const followUpCompletionRate =
    followUps.length > 0 ? Number(((completedFollowUps / followUps.length) * 100).toFixed(2)) : 0;
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
  const siteVisitsNoShow = siteVisits.filter((visit) => visit.visit_status === "no_show").length;
  const siteVisitsCancelled = siteVisits.filter((visit) => visit.visit_status === "cancelled").length;

  const totalDeals = deals.length;
  const wonDeals = deals.filter((deal) => deal.deal_status === "booked" || deal.deal_status === "closed").length;
  const totalDealValue = deals.reduce((sum, deal) => sum + Number(deal.deal_value ?? 0), 0);

  const sourceMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  const stageMap = new Map<string, number>();
  const assigneeMap = new Map<string, number>();
  const potentialMap = new Map<string, { leads: number; won: number }>();

  for (const lead of leads) {
    increment(sourceMap, lead.source_platform || lead.source || "unknown");
    increment(cityMap, lead.city || "unknown");
    increment(stageMap, lead.pipeline_stage || "unknown");
    increment(assigneeMap, lead.assigned_to || "unassigned");

    const potential = lead.lead_priority || lead.score_bucket || "unknown";
    const current = potentialMap.get(potential) ?? { leads: 0, won: 0 };
    current.leads += 1;
    if (lead.lead_status === "won" || lead.pipeline_stage === "booked") {
      current.won += 1;
    }
    potentialMap.set(potential, current);
  }

  const openLeadAgingMap = new Map<string, number>([
    ["0-3 days", 0],
    ["4-7 days", 0],
    ["8-14 days", 0],
    ["15+ days", 0]
  ]);
  for (const lead of leads) {
    if (lead.lead_status !== "open") {
      continue;
    }
    const created = new Date(lead.created_at);
    if (Number.isNaN(created.valueOf())) {
      continue;
    }
    const ageDays = Math.floor((now.valueOf() - created.valueOf()) / (1000 * 60 * 60 * 24));
    if (ageDays <= 3) {
      increment(openLeadAgingMap, "0-3 days");
    } else if (ageDays <= 7) {
      increment(openLeadAgingMap, "4-7 days");
    } else if (ageDays <= 14) {
      increment(openLeadAgingMap, "8-14 days");
    } else {
      increment(openLeadAgingMap, "15+ days");
    }
  }

  const firstCompletedFollowUpByLead = new Map<string, Date>();
  for (const followUp of followUps) {
    if (followUp.status !== "completed") {
      continue;
    }
    const completedDate = new Date(followUp.completed_at || followUp.created_at);
    if (Number.isNaN(completedDate.valueOf())) {
      continue;
    }
    const existing = firstCompletedFollowUpByLead.get(followUp.lead_id);
    if (!existing || completedDate < existing) {
      firstCompletedFollowUpByLead.set(followUp.lead_id, completedDate);
    }
  }
  let responseHoursSum = 0;
  let responseHoursCount = 0;
  for (const lead of leads) {
    const first = firstCompletedFollowUpByLead.get(lead.id);
    if (!first) {
      continue;
    }
    const created = new Date(lead.created_at);
    if (Number.isNaN(created.valueOf())) {
      continue;
    }
    const diffHours = (first.valueOf() - created.valueOf()) / (1000 * 60 * 60);
    if (diffHours >= 0) {
      responseHoursSum += diffHours;
      responseHoursCount += 1;
    }
  }
  const avgResponseHours =
    responseHoursCount > 0 ? Number((responseHoursSum / responseHoursCount).toFixed(2)) : 0;

  const userMap = new Map(users.map((user) => [user.id, user.full_name]));
  const assigneePerformanceMap = new Map<string, AssigneePerformanceItem>();
  const ensureAssignee = (userId: string): AssigneePerformanceItem => {
    const existing = assigneePerformanceMap.get(userId);
    if (existing) {
      return existing;
    }
    const next: AssigneePerformanceItem = {
      userId,
      name: userMap.get(userId) ?? "Unknown user",
      leads: 0,
      followUpsCompleted: 0,
      visitsCompleted: 0,
      conversions: 0
    };
    assigneePerformanceMap.set(userId, next);
    return next;
  };

  for (const lead of leads) {
    if (!lead.assigned_to) {
      continue;
    }
    const entry = ensureAssignee(lead.assigned_to);
    entry.leads += 1;
    if (lead.lead_status === "won" || lead.pipeline_stage === "booked") {
      entry.conversions += 1;
    }
  }
  for (const followUp of followUps) {
    if (followUp.status !== "completed") {
      continue;
    }
    const entry = ensureAssignee(followUp.assigned_user_id);
    entry.followUpsCompleted += 1;
  }
  for (const visit of siteVisits) {
    if (visit.visit_status !== "completed") {
      continue;
    }
    const entry = ensureAssignee(visit.assigned_sales_user_id);
    entry.visitsCompleted += 1;
  }

  const potentialConversion = Array.from(potentialMap.entries())
    .map(([key, value]) => ({
      key,
      count: value.leads === 0 ? 0 : Number(((value.won / value.leads) * 100).toFixed(2))
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalLeads,
    openLeads,
    hotLeads,
    conversionRate,
    pendingFollowUps,
    overdueFollowUps,
    followUpCompletionRate,
    siteVisitsScheduled,
    siteVisitsCompleted,
    siteVisitsNoShow,
    siteVisitsCancelled,
    totalDeals,
    totalDealValue,
    wonDeals,
    avgResponseHours,
    sourceCounts: mapToSortedCounts(sourceMap),
    cityCounts: mapToSortedCounts(cityMap),
    stageCounts: mapToSortedCounts(stageMap),
    assigneeCounts: mapToSortedCounts(assigneeMap).map((item) => ({
      ...item,
      key: userMap.get(item.key) ?? item.key
    })),
    leadAgingBuckets: mapToSortedCounts(openLeadAgingMap),
    potentialConversion,
    assigneePerformance: Array.from(assigneePerformanceMap.values()).sort(
      (a, b) => b.conversions - a.conversions
    )
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
