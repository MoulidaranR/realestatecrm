import { NextResponse } from "next/server";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/errors";

export async function PATCH(req: Request) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);

    const body = (await req.json()) as { id: string; is_active: boolean };
    if (!body.id) return NextResponse.json({ error: "Source ID is required." }, { status: 400 });

    const supabase = await createServerSupabaseClient();

    // Verify it belongs to this company
    const { data: src } = await supabase
      .from("lead_sources")
      .select("id")
      .eq("id", body.id)
      .eq("company_id", actor.profile.company_id)
      .single();

    if (!src) return NextResponse.json({ error: "Lead source not found." }, { status: 404 });

    const { error } = await supabase
      .from("lead_sources")
      .update({ is_active: body.is_active })
      .eq("id", body.id);

    if (error) return NextResponse.json({ error: mapDbError(error, "update lead source") }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    return NextResponse.json({ error: mapDbError(err, "PATCH lead source") }, { status: 500 });
  }
}
