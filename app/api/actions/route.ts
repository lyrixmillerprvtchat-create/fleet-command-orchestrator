import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { executeAppiumAction } from "@/lib/appium";
import { ActionPayload } from "@/types/fleet";

export async function POST(req: NextRequest) {
  const body: ActionPayload = await req.json();
  const { fleet_id, action, params } = body;

  if (!fleet_id || !action) {
    return NextResponse.json(
      { error: "fleet_id and action are required" },
      { status: 400 }
    );
  }

  const db = getSupabaseAdmin();

  const { data: fleet, error } = await db
    .from("fleets")
    .select("*")
    .eq("id", fleet_id)
    .single();

  if (error || !fleet) {
    return NextResponse.json({ error: "Fleet not found" }, { status: 404 });
  }

  await db
    .from("fleets")
    .update({ status: "Busy", updated_at: new Date().toISOString() })
    .eq("id", fleet_id);

  const result = await executeAppiumAction(fleet, action, params);

  await db
    .from("fleets")
    .update({
      status: result.success ? "Online" : "Offline",
      updated_at: new Date().toISOString(),
    })
    .eq("id", fleet_id);

  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
