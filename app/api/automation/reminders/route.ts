import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token || token !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: dueSoonFollowUps, error: dueSoonError } = await admin
    .from("follow_ups")
    .select("id, company_id, lead_id, assigned_user_id, due_at, priority")
    .eq("status", "pending")
    .gte("due_at", now.toISOString())
    .lte("due_at", in24Hours.toISOString())
    .limit(500);

  if (dueSoonError) {
    return NextResponse.json({ error: dueSoonError.message }, { status: 400 });
  }

  const { data: overdueFollowUps, error: overdueError } = await admin
    .from("follow_ups")
    .select("id, company_id, lead_id, assigned_user_id, due_at, priority")
    .eq("status", "pending")
    .lt("due_at", now.toISOString())
    .limit(500);

  if (overdueError) {
    return NextResponse.json({ error: overdueError.message }, { status: 400 });
  }

  let created = 0;
  for (const followUp of dueSoonFollowUps ?? []) {
    await createNotification(admin, {
      companyId: followUp.company_id,
      userProfileId: followUp.assigned_user_id,
      notificationType: "reminder",
      eventType: "followup.due_soon",
      entityType: "follow_up",
      entityId: followUp.id,
      actionUrl: "/follow-ups",
      title: "Follow-up due soon",
      message: `Lead ${followUp.lead_id} follow-up is due at ${new Date(followUp.due_at).toLocaleString()}`,
      payload: {
        followUpId: followUp.id,
        leadId: followUp.lead_id,
        dueAt: followUp.due_at
      }
    });
    created += 1;
  }

  for (const followUp of overdueFollowUps ?? []) {
    await createNotification(admin, {
      companyId: followUp.company_id,
      userProfileId: followUp.assigned_user_id,
      notificationType: "reminder",
      eventType: "followup.overdue",
      entityType: "follow_up",
      entityId: followUp.id,
      actionUrl: "/follow-ups",
      title: "Follow-up overdue",
      message: `Lead ${followUp.lead_id} follow-up is overdue since ${new Date(followUp.due_at).toLocaleString()}`,
      payload: {
        followUpId: followUp.id,
        leadId: followUp.lead_id,
        dueAt: followUp.due_at
      }
    });
    created += 1;
  }

  return NextResponse.json({
    success: true,
    scanned: (dueSoonFollowUps ?? []).length + (overdueFollowUps ?? []).length,
    notificationsCreated: created
  });
}
