import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = getSupabaseAdmin();
  const { data: fleets, error } = await db
    .from("fleets")
    .select("id, api_url, credentials, status");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = await Promise.allSettled(
    (fleets ?? []).map(async (fleet) => {
      // Skip nodes that are actively running a test
      if (fleet.status === "Busy") {
        return { id: fleet.id, status: "Busy", skipped: true };
      }

      const headers: Record<string, string> = {};
      const creds = fleet.credentials as { username?: string; access_key?: string } | null;
      if (creds?.username && creds?.access_key) {
        const token = Buffer.from(`${creds.username}:${creds.access_key}`).toString("base64");
        headers["Authorization"] = `Basic ${token}`;
      }

      let online = false;
      try {
        const base = fleet.api_url.replace(/\/$/, "");
        const res = await fetch(`${base}/status`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(8000),
        });
        online = res.status < 500;
      } catch {
        online = false;
      }

      const newStatus = online ? "Online" : "Offline";
      await db
        .from("fleets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", fleet.id);

      return { id: fleet.id, status: newStatus };
    })
  );

  const summary = results.map((r) =>
    r.status === "fulfilled" ? r.value : { error: String(r.reason) }
  );

  return NextResponse.json({ checked: summary.length, results: summary });
}
