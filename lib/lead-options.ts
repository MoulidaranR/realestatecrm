import type {
  FollowUpMode,
  FollowUpPriority,
  FollowUpStatus,
  LeadPriority,
  PipelineStage,
  SiteVisitStatus,
  SourcePlatform
} from "@/lib/db-types";

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

export const LEAD_PRIORITIES: LeadPriority[] = ["hot", "warm", "cold"];

export const SOURCE_PLATFORMS: SourcePlatform[] = [
  "manual",
  "website",
  "99acres",
  "magicbricks",
  "facebook",
  "instagram",
  "google_ads",
  "referral",
  "walk_in",
  "other"
];

export const FOLLOW_UP_STATUSES: FollowUpStatus[] = [
  "pending",
  "completed",
  "missed",
  "cancelled"
];

export const FOLLOW_UP_MODES: FollowUpMode[] = ["call", "whatsapp", "sms", "email", "meeting"];
export const FOLLOW_UP_PRIORITIES: FollowUpPriority[] = ["high", "medium", "low"];

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
