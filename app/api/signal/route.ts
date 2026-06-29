import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";
import {
  storeSignal,
  fetchSignals,
  clearSignals,
  SignalType,
  SignalOrigin,
} from "@/lib/signal";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.token || !body?.type || !body?.origin || body?.payload == null) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const session = verifySessionToken(body.token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ok = await storeSignal(
    session.sessionId,
    body.type as SignalType,
    body.origin as SignalOrigin,
    body.payload
  );

  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "store failed" }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const type = req.nextUrl.searchParams.get("type") as SignalType | null;
  const origin = req.nextUrl.searchParams.get("origin") as SignalOrigin | null;

  if (!token || !type || !origin) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const signals = await fetchSignals(session.sessionId, type, origin);

  // Consume ICE candidates after reading so they aren't replayed
  if (type === "ice-candidate" && signals.length > 0) {
    await clearSignals(session.sessionId, type, origin);
  }

  return NextResponse.json({ signals });
}
