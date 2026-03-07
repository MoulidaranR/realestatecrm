import type { FollowUpStatus, PipelineStage, SiteVisitStatus } from "@/lib/db-types";

export const PIPELINE_STAGES: PipelineStage[] = [
  "new",
  "attempted",
  "contacted",
  "interested",
  "follow_up_due",
  "site_visit_planned",
  "visit_done",
  "negotiation",
  "booked",
  "lost"
];

export const FOLLOW_UP_STATUSES: FollowUpStatus[] = ["pending", "completed", "cancelled"];

export const SITE_VISIT_STATUSES: SiteVisitStatus[] = [
  "scheduled",
  "completed",
  "no_show",
  "rescheduled",
  "cancelled"
];

export function formatStageLabel(stage: string): string {
  return stage
    .split("_")
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}
