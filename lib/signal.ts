import { getSupabaseAdmin } from "./supabase";

export type SignalType = "offer" | "answer" | "ice-candidate";
export type SignalOrigin = "host" | "client";

export async function storeSignal(
  sessionId: string,
  type: SignalType,
  origin: SignalOrigin,
  payload: unknown
): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("signals")
    .insert({ session_id: sessionId, type, origin, payload });
  return !error;
}

export async function fetchSignals(
  sessionId: string,
  type: SignalType,
  origin: SignalOrigin
) {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("signals")
    .select("*")
    .eq("session_id", sessionId)
    .eq("type", type)
    .eq("origin", origin)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function clearSignals(
  sessionId: string,
  type: SignalType,
  origin: SignalOrigin
) {
  const db = getSupabaseAdmin();
  await db
    .from("signals")
    .delete()
    .eq("session_id", sessionId)
    .eq("type", type)
    .eq("origin", origin);
}
