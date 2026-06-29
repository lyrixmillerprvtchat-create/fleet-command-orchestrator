import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, verifySessionToken } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fleet_id = body?.fleet_id;
  if (!fleet_id) {
    return NextResponse.json({ error: "fleet_id required" }, { status: 400 });
  }

  const { token, sessionId } = createSessionToken(fleet_id);
  const db = getSupabaseAdmin();

  const { error } = await db.from("sessions").insert({
    id: sessionId,
    fleet_id,
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessionId, token });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "invalid or expired token" },
      { status: 401 }
    );
  }

  const db = getSupabaseAdmin();
  const { data: session, error } = await db
    .from("sessions")
    .select("id, fleet_id, status, last_seen_at")
    .eq("id", payload.sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  await db
    .from("sessions")
    .update({ last_seen_at: new Date().toISOString(), status: "active" })
    .eq("id", payload.sessionId);

  return NextResponse.json({
    sessionId: payload.sessionId,
    fleetId: payload.fleetId,
    status: session.status,
  });
}
