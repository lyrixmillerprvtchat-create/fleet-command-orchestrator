import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createTokenForSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const fleet_id = req.nextUrl.searchParams.get("fleet_id");
  const access_key = req.nextUrl.searchParams.get("access_key");

  if (!fleet_id || !access_key) {
    return NextResponse.json(
      { error: "fleet_id and access_key required" },
      { status: 400 }
    );
  }

  const db = getSupabaseAdmin();

  // Verify the fleet node and its access_key
  const { data: fleet } = await db
    .from("fleets")
    .select("id, credentials")
    .eq("id", fleet_id)
    .single();

  if (!fleet || fleet.credentials?.access_key !== access_key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Find active sessions that have an unanswered client offer
  const { data: sessions } = await db
    .from("sessions")
    .select("id, status")
    .eq("fleet_id", fleet_id)
    .in("status", ["pending", "active"])
    .gt("expires_at", new Date().toISOString());

  if (!sessions?.length) {
    return NextResponse.json({ sessions: [] });
  }

  const result = [];

  for (const session of sessions) {
    // Check for an unanswered offer from the client
    const { data: offers } = await db
      .from("signals")
      .select("payload, created_at")
      .eq("session_id", session.id)
      .eq("type", "offer")
      .eq("origin", "client")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!offers?.length) continue;

    // Skip if we already sent an answer for this offer
    const { data: answers } = await db
      .from("signals")
      .select("id, created_at")
      .eq("session_id", session.id)
      .eq("type", "answer")
      .eq("origin", "host")
      .order("created_at", { ascending: false })
      .limit(1);

    const offerTime = new Date(offers[0].created_at).getTime();
    const answerTime = answers?.length
      ? new Date(answers[0].created_at).getTime()
      : 0;

    // Only return the session if the offer is newer than the latest answer
    if (offerTime <= answerTime) continue;

    // Mint a host-side token for this session so the agent can post signals
    const token = createTokenForSession(session.id, fleet_id);

    result.push({
      sessionId: session.id,
      token,
      offer: offers[0].payload,
    });
  }

  return NextResponse.json({ sessions: result });
}
