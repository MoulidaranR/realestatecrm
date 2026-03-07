import type { SupabaseClient } from "@supabase/supabase-js";

type LeadRow = {
  id: string;
  lead_status: string;
  budget_min: number | null;
  budget_max: number | null;
  preferred_location: string | null;
  last_contacted_at: string | null;
  updated_at: string;
};

type FollowUpRow = {
  due_at: string;
  status: string;
};

type SiteVisitRow = {
  visit_status: string;
};

function scoreBucket(score: number): "hot" | "warm" | "cold" {
  if (score >= 60) {
    return "hot";
  }
  if (score >= 25) {
    return "warm";
  }
  return "cold";
}

function computeScore(
  lead: LeadRow,
  followUps: FollowUpRow[],
  siteVisits: SiteVisitRow[]
): number {
  let score = 0;
  if (lead.last_contacted_at) {
    score += 10;
  }
  if (lead.budget_min !== null || lead.budget_max !== null) {
    score += 20;
  }
  if (lead.preferred_location) {
    score += 15;
  }
  if (siteVisits.some((visit) => ["scheduled", "rescheduled", "completed"].includes(visit.visit_status))) {
    score += 30;
  }

  const now = new Date();
  if (
    followUps.some((followUp) => {
      if (followUp.status !== "pending") {
        return false;
      }
      const dueDate = new Date(followUp.due_at);
      return dueDate < now;
    })
  ) {
    score -= 10;
  }

  const updatedAt = new Date(lead.updated_at);
  if (!Number.isNaN(updatedAt.valueOf())) {
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    if (updatedAt < fourteenDaysAgo) {
      score -= 20;
    }
  }

  return Math.max(score, 0);
}

function derivePipelineStage(
  lead: LeadRow,
  followUps: FollowUpRow[],
  siteVisits: SiteVisitRow[]
): string {
  if (lead.lead_status === "won") {
    return "booked";
  }
  if (lead.lead_status === "lost") {
    return "lost";
  }
  if (siteVisits.some((visit) => visit.visit_status === "completed")) {
    return "visit_done";
  }
  if (siteVisits.some((visit) => ["scheduled", "rescheduled"].includes(visit.visit_status))) {
    return "site_visit_planned";
  }
  if (followUps.some((followUp) => followUp.status === "pending")) {
    return "follow_up_due";
  }
  if (lead.last_contacted_at) {
    return "contacted";
  }
  if (followUps.length > 0) {
    return "attempted";
  }
  return "new";
}

function computeNextFollowUpAt(followUps: FollowUpRow[]): string | null {
  const pendingDates = followUps
    .filter((followUp) => followUp.status === "pending")
    .map((followUp) => new Date(followUp.due_at))
    .filter((date) => !Number.isNaN(date.valueOf()))
    .sort((a, b) => a.valueOf() - b.valueOf());

  return pendingDates[0] ? pendingDates[0].toISOString() : null;
}

export async function refreshLeadAutomation(
  admin: SupabaseClient,
  leadId: string,
  companyId: string
): Promise<void> {
  const { data: lead } = await admin
    .from("leads")
    .select("id, lead_status, budget_min, budget_max, preferred_location, last_contacted_at, updated_at")
    .eq("id", leadId)
    .eq("company_id", companyId)
    .single();
  if (!lead) {
    return;
  }

  const [{ data: followUps }, { data: siteVisits }] = await Promise.all([
    admin.from("follow_ups").select("due_at, status").eq("lead_id", leadId).eq("company_id", companyId),
    admin
      .from("site_visits")
      .select("visit_status")
      .eq("lead_id", leadId)
      .eq("company_id", companyId)
  ]);

  const typedLead = lead as LeadRow;
  const typedFollowUps = (followUps ?? []) as FollowUpRow[];
  const typedSiteVisits = (siteVisits ?? []) as SiteVisitRow[];
  const score = computeScore(typedLead, typedFollowUps, typedSiteVisits);
  const pipelineStage = derivePipelineStage(typedLead, typedFollowUps, typedSiteVisits);

  await admin
    .from("leads")
    .update({
      score,
      score_bucket: scoreBucket(score),
      pipeline_stage: pipelineStage,
      next_followup_at: computeNextFollowUpAt(typedFollowUps),
      last_scored_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", leadId)
    .eq("company_id", companyId);
}
