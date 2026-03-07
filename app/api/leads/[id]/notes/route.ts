import { NextResponse } from "next/server";
import { getActorContext, requirePermission } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await getActorContext();
    await requirePermission(actor, "leads.update");
    const { id } = await context.params;

    const payload = (await request.json()) as { note?: string };
    const note = payload.note?.trim();
    if (!note) {
      return NextResponse.json({ error: "Note is required" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data: lead, error: leadError } = await admin
      .from("leads")
      .select("id, company_id")
      .eq("id", id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (lead.company_id !== actor.profile.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: noteError } = await admin.from("lead_notes").insert({
      company_id: actor.profile.company_id,
      lead_id: id,
      author_user_id: actor.profile.id,
      note_text: note
    });
    if (noteError) {
      return NextResponse.json({ error: noteError.message }, { status: 400 });
    }

    const notesSummary = note.length > 220 ? `${note.slice(0, 217)}...` : note;
    const { error: updateError } = await admin
      .from("leads")
      .update({ notes_summary: notesSummary, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await logActivity(admin, {
      companyId: actor.profile.company_id,
      actorUserId: actor.profile.id,
      entityType: "lead",
      entityId: id,
      action: "lead.note_added",
      description: "Lead note added"
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
