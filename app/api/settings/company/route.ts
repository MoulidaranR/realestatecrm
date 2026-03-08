import { NextResponse } from "next/server";
import { getActorContext, requireCompanyAdmin } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapDbError } from "@/lib/errors";

export async function PATCH(req: Request) {
  try {
    const actor = await getActorContext();
    requireCompanyAdmin(actor);

    const body = (await req.json()) as Record<string, unknown>;
    const allowed = ["name","brand_name","phone","email","website","address","city","state","pincode","gst_number","timezone","business_type"];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key] || null;
    }
    if (body.name) update.name = String(body.name).trim();

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("companies")
      .update(update)
      .eq("id", actor.profile.company_id);

    if (error) return NextResponse.json({ error: mapDbError(error, "update company") }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    return NextResponse.json({ error: mapDbError(err, "PATCH company") }, { status: 500 });
  }
}
