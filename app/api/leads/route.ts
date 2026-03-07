import { NextResponse } from "next/server";
import type { LeadPriority, LeadStatus, PipelineStage } from "@/lib/db-types";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import { PIPELINE_STAGES, SOURCE_PLATFORMS } from "@/lib/lead-options";

const LEAD_STATUSES: LeadStatus[] = ["open", "won", "lost", "cold"];
const LEAD_PRIORITIES: LeadPriority[] = ["hot", "warm", "cold"];
const BUYING_PURPOSES = ["self_use", "investment"] as const;

type CreateLeadPayload = {
  fullName?: string;
  phone?: string;
  primaryPhone?: string;
  alternatePhone?: string;
  email?: string;
  city?: string;
  preferredLocation?: string;
  propertyType?: string;
  budgetMin?: number | string | null;
  budgetMax?: number | string | null;
  buyingPurpose?: "self_use" | "investment" | null;
  sourcePlatform?: string;
  sourceCampaign?: string;
  source?: string;
  capturedByUserId?: string | null;
  assignedToUserId?: string | null;
  leadPriority?: LeadPriority;
  score?: number;
  status?: LeadStatus;
  stage?: PipelineStage;
  bhkPreference?: string;
  possessionTimeline?: string;
  financingNeeded?: boolean;
  loanStatus?: string;
  siteVisitInterest?: boolean;
  nextFollowupAt?: string;
  notes?: string;
  occupation?: string;
  companyName?: string;
  familySize?: number | string | null;
  preferredContactTime?: string;
  tags?: string[] | string;
  requirementsSummary?: string;
};

function isValidPhone(value: string): boolean {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized.length >= 8 && normalized.length <= 16;
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toNullableInteger(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  if (!Number.isInteger(num)) {
    return null;
  }
  return num;
}

function normalizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) {
    return [];
  }
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, 20);
  }
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 20);
}

function scoreToPriority(score: number): LeadPriority {
  if (score >= 70) {
    return "hot";
  }
  if (score >= 35) {
    return "warm";
  }
  return "cold";
}

export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "leads.create");

    const payload = (await request.json()) as CreateLeadPayload;

    const fullName = payload.fullName?.trim();
    const phone = payload.primaryPhone?.trim() || payload.phone?.trim() || "";
    const alternatePhone = payload.alternatePhone?.trim() || null;
    const email = payload.email?.trim().toLowerCase() || null;
    const city = payload.city?.trim() || null;
    const preferredLocation = payload.preferredLocation?.trim() || null;
    const propertyType = payload.propertyType?.trim() || null;
    const budgetMin = toNullableNumber(payload.budgetMin);
    const budgetMax = toNullableNumber(payload.budgetMax);
    const buyingPurpose = payload.buyingPurpose ?? null;
    const sourcePlatform = (payload.sourcePlatform?.trim() || "manual").toLowerCase();
    const sourceCampaign = payload.sourceCampaign?.trim() || null;
    const source = payload.source?.trim() || sourcePlatform;
    const leadStatus = payload.status ?? "open";
    const stage = payload.stage ?? "new";
    const requestedScore = Number(payload.score ?? 0);
    const score = Number.isFinite(requestedScore)
      ? Math.max(0, Math.min(100, Math.round(requestedScore)))
      : 0;
    const leadPriority = payload.leadPriority ?? scoreToPriority(score);
    const bhkPreference = payload.bhkPreference?.trim() || null;
    const possessionTimeline = payload.possessionTimeline?.trim() || null;
    const financingNeeded = Boolean(payload.financingNeeded);
    const loanStatus = payload.loanStatus?.trim() || null;
    const siteVisitInterest = Boolean(payload.siteVisitInterest);
    const occupation = payload.occupation?.trim() || null;
    const companyName = payload.companyName?.trim() || null;
    const familySize = toNullableInteger(payload.familySize);
    const preferredContactTime = payload.preferredContactTime?.trim() || null;
    const tags = normalizeTags(payload.tags);
    const requirementsSummary = payload.requirementsSummary?.trim() || null;
    const notes = payload.notes?.trim() || null;

    if (!fullName || !phone) {
      return NextResponse.json(
        { error: "Full name and primary phone are required" },
        { status: 400 }
      );
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "Invalid primary phone number" }, { status: 400 });
    }
    if (alternatePhone && !isValidPhone(alternatePhone)) {
      return NextResponse.json({ error: "Invalid alternate phone number" }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (budgetMin !== null && budgetMin < 0) {
      return NextResponse.json({ error: "Budget min must be non-negative" }, { status: 400 });
    }
    if (budgetMax !== null && budgetMax < 0) {
      return NextResponse.json({ error: "Budget max must be non-negative" }, { status: 400 });
    }
    if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
      return NextResponse.json(
        { error: "Budget min should not be greater than budget max" },
        { status: 400 }
      );
    }
    if (buyingPurpose && !BUYING_PURPOSES.includes(buyingPurpose)) {
      return NextResponse.json({ error: "Invalid buying purpose" }, { status: 400 });
    }
    if (!SOURCE_PLATFORMS.includes(sourcePlatform as (typeof SOURCE_PLATFORMS)[number])) {
      return NextResponse.json({ error: "Invalid source platform" }, { status: 400 });
    }
    if (!LEAD_STATUSES.includes(leadStatus)) {
      return NextResponse.json({ error: "Invalid lead status" }, { status: 400 });
    }
    if (!PIPELINE_STAGES.includes(stage)) {
      return NextResponse.json({ error: "Invalid lead stage" }, { status: 400 });
    }
    if (!LEAD_PRIORITIES.includes(leadPriority)) {
      return NextResponse.json({ error: "Invalid lead priority" }, { status: 400 });
    }

    let nextFollowupAtIso: string | null = null;
    if (payload.nextFollowupAt?.trim()) {
      const parsed = new Date(payload.nextFollowupAt);
      if (Number.isNaN(parsed.valueOf())) {
        return NextResponse.json({ error: "Invalid next follow-up datetime" }, { status: 400 });
      }
      nextFollowupAtIso = parsed.toISOString();
    }

    const admin = createAdminSupabaseClient();

    const capturedByUserId = payload.capturedByUserId ?? actor.profile.id;
    const assignedToUserId = payload.assignedToUserId ?? actor.profile.id;

    const candidateUsers = Array.from(
      new Set([capturedByUserId, assignedToUserId].filter((value): value is string => Boolean(value)))
    );
    if (candidateUsers.length > 0) {
      const { data: users } = await admin
        .from("user_profiles")
        .select("id, status, company_id")
        .in("id", candidateUsers);

      const userMap = new Map((users ?? []).map((user) => [user.id, user]));
      for (const userId of candidateUsers) {
        const user = userMap.get(userId);
        if (!user || user.company_id !== actor.profile.company_id) {
          return NextResponse.json({ error: "Invalid user assignment" }, { status: 400 });
        }
        if (user.status !== "active") {
          return NextResponse.json({ error: "Assigned/captured user must be active" }, { status: 400 });
        }
      }
    }

    const { data: lead, error: leadError } = await admin
      .from("leads")
      .insert({
        company_id: actor.profile.company_id,
        created_by: actor.profile.id,
        captured_by: capturedByUserId,
        assigned_to: assignedToUserId,
        full_name: fullName,
        phone,
        alternate_phone: alternatePhone,
        email,
        city,
        preferred_location: preferredLocation,
        property_type: propertyType,
        budget_min: budgetMin,
        budget_max: budgetMax,
        buying_purpose: buyingPurpose,
        source_platform: sourcePlatform,
        source_campaign: sourceCampaign,
        source,
        lead_priority: leadPriority,
        score,
        score_bucket: leadPriority,
        lead_status: leadStatus,
        pipeline_stage: stage,
        bhk_preference: bhkPreference,
        possession_timeline: possessionTimeline,
        financing_needed: financingNeeded,
        loan_status: loanStatus,
        site_visit_interest: siteVisitInterest,
        next_followup_at: nextFollowupAtIso,
        occupation,
        company_name: companyName,
        family_size: familySize,
        preferred_contact_time: preferredContactTime,
        tags,
        requirements_summary: requirementsSummary,
        notes_summary: notes
      })
      .select("id")
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: leadError?.message ?? "Failed to create lead" },
        { status: 400 }
      );
    }

    if (notes) {
      await admin.from("lead_notes").insert({
        company_id: actor.profile.company_id,
        lead_id: lead.id,
        author_user_id: actor.profile.id,
        note_text: notes
      });
    }

    if (nextFollowupAtIso) {
      await admin.from("follow_ups").insert({
        company_id: actor.profile.company_id,
        lead_id: lead.id,
        assigned_user_id: assignedToUserId,
        due_at: nextFollowupAtIso,
        status: "pending",
        mode: "call",
        purpose: "Initial follow-up",
        priority: leadPriority === "hot" ? "high" : "medium",
        note: "Auto-created during lead capture"
      });
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "lead",
      entityId: lead.id,
      action: "lead.created",
      description: `Lead ${fullName} created`,
      after: {
        assignedToUserId,
        leadPriority,
        stage
      }
    });

    if (assignedToUserId !== actor.profile.id) {
      await createNotification(admin, {
        companyId: actor.profile.company_id,
        userProfileId: assignedToUserId,
        notificationType: "assignment",
        eventType: "lead.assigned",
        entityType: "lead",
        entityId: lead.id,
        actionUrl: `/leads/${lead.id}`,
        title: "New lead assigned",
        message: `${fullName} has been assigned to you.`,
        payload: {
          leadId: lead.id
        }
      });
    }

    return NextResponse.json({ success: true, id: lead.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
