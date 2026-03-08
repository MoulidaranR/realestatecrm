import type { RoleKey } from "@/lib/constants";

export type UserStatus = "active" | "invited" | "disabled";

export type UserProfile = {
  id: string;
  auth_user_id: string | null;
  company_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role_key: RoleKey;
  manager_user_id: string | null;
  invited_by: string | null;
  invited_at: string | null;
  status: UserStatus;
  access_mode: "role_only" | "custom_override";
  created_at: string;
  last_active_at: string | null;
};


export type Company = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  plan: string;
  status: string;
  created_at: string;
};

export type PipelineStage =
  | "new"
  | "attempted"
  | "contacted"
  | "interested"
  | "follow_up_due"
  | "site_visit_planned"
  | "visit_done"
  | "negotiation"
  | "booked"
  | "lost";

export type LeadStatus = "open" | "won" | "lost" | "cold";

export type BuyingPurpose = "self_use" | "investment";
export type SourcePlatform =
  | "manual"
  | "website"
  | "99acres"
  | "magicbricks"
  | "facebook"
  | "instagram"
  | "google_ads"
  | "referral"
  | "walk_in"
  | "other";
export type LeadPriority = "hot" | "warm" | "cold";

export type Lead = {
  id: string;
  company_id: string;
  created_by: string;
  captured_by: string;
  assigned_to: string | null;
  full_name: string;
  phone: string;
  alternate_phone: string | null;
  email: string | null;
  city: string | null;
  preferred_location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  property_type: string | null;
  buying_purpose: BuyingPurpose | null;
  source_platform: SourcePlatform;
  source_campaign: string | null;
  source: string;
  lead_priority: LeadPriority;
  pipeline_stage: PipelineStage;
  lead_status: LeadStatus;
  score: number;
  score_bucket: "hot" | "warm" | "cold";
  last_scored_at: string | null;
  next_followup_at: string | null;
  last_contacted_at: string | null;
  bhk_preference: string | null;
  possession_timeline: string | null;
  financing_needed: boolean;
  loan_status: string | null;
  site_visit_interest: boolean;
  occupation: string | null;
  company_name: string | null;
  family_size: number | null;
  preferred_contact_time: string | null;
  tags: string[];
  requirements_summary: string | null;
  notes_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowUpStatus = "pending" | "completed" | "missed" | "cancelled";
export type FollowUpMode = "call" | "whatsapp" | "sms" | "email" | "meeting";
export type FollowUpPriority = "low" | "medium" | "high";

export type FollowUp = {
  id: string;
  company_id: string;
  lead_id: string;
  assigned_user_id: string;
  due_at: string;
  status: FollowUpStatus;
  mode: FollowUpMode;
  purpose: string | null;
  outcome: string | null;
  priority: FollowUpPriority;
  next_followup_at: string | null;
  completed_at: string | null;
  reminder_sent: boolean;
  note: string | null;
  created_at: string;
};

export type SiteVisitStatus =
  | "scheduled"
  | "completed"
  | "no_show"
  | "rescheduled"
  | "cancelled";

export type SiteVisit = {
  id: string;
  company_id: string;
  lead_id: string;
  assigned_sales_user_id: string;
  visit_date: string;
  visit_status: SiteVisitStatus;
  project_name: string | null;
  location: string | null;
  pickup_required: boolean;
  pickup_address: string | null;
  outcome: string | null;
  notes: string | null;
  next_action: string | null;
  next_followup_at: string | null;
  outcome_note: string | null;
  created_at: string;
};

export type LeadNote = {
  id: string;
  company_id: string;
  lead_id: string;
  author_user_id: string;
  note_text: string;
  created_at: string;
};

export type DealStatus = "open" | "booked" | "closed" | "lost";

export type Deal = {
  id: string;
  company_id: string;
  lead_id: string;
  sales_user_id: string;
  deal_value: number;
  booking_amount: number;
  deal_status: DealStatus;
  closed_at: string | null;
  created_at: string;
};

export type NotificationChannel = "in_app" | "email";
export type NotificationType =
  | "assignment"
  | "reminder"
  | "status_change"
  | "user_management"
  | "system";

export type Notification = {
  id: string;
  company_id: string;
  user_profile_id: string;
  channel: NotificationChannel;
  notification_type: NotificationType;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  title: string;
  message: string;
  payload_json: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  company_id: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  description: string;
  metadata_json: Record<string, unknown>;
  before_json: Record<string, unknown>;
  after_json: Record<string, unknown>;
  created_at: string;
};

export type ImportJobStatus = "queued" | "processing" | "completed" | "failed";

export type DuplicateHandling = "skip" | "update_existing" | "import_anyway" | "manual_review";

export type ImportJob = {
  id: string;
  company_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: "csv" | "xlsx";
  mapping_json: Record<string, unknown>;
  duplicate_handling: DuplicateHandling;
  status: ImportJobStatus;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  created_at: string;
  completed_at: string | null;
};

export type ImportRowStatus = "pending" | "success" | "failed" | "duplicate";

export type ImportRow = {
  id: string;
  import_job_id: string;
  raw_data_json: Record<string, unknown>;
  parsed_data_json: Record<string, unknown>;
  row_status: ImportRowStatus;
  error_message: string | null;
};

export type ImportTemplate = {
  id: string;
  company_id: string;
  created_by: string;
  template_name: string;
  mapping_json: Record<string, string>;
  created_at: string;
};
