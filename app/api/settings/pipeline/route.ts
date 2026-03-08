import { NextResponse } from "next/server";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/errors";

export async function PATCH(req: Request) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);

    const body = (await req.json()) as { id: string; stage_label?: string; stage_probability?: number };
    if (!body.id) return NextResponse.json({ error: "Stage ID is required." }, { status: 400 });

    const supabase = await createServerSupabaseClient();

    const { data: stage } = await supabase
      .from("pipeline_stage_config")
      .select("id")
      .eq("id", body.id)
      .eq("company_id", actor.profile.company_id)
      .single();
    if (!stage) return NextResponse.json({ error: "Stage not found." }, { status: 404 });

    const update: Record<string, unknown> = {};
    if (body.stage_label !== undefined) update.stage_label = String(body.stage_label).trim();
    if (body.stage_probability !== undefined) {
      const prob = Math.min(100, Math.max(0, Number(body.stage_probability)));
      update.stage_probability = prob;
    }

    const { error } = await supabase.from("pipeline_stage_config").update(update).eq("id", body.id);
    if (error) return NextResponse.json({ error: mapDbError(error, "update pipeline stage") }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    return NextResponse.json({ error: mapDbError(err, "PATCH pipeline stage") }, { status: 500 });
  }
}
