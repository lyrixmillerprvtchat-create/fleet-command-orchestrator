import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { AppiumDevice } from "@/lib/device";
import { ClaudeLLM } from "@/lib/llm";
import { runAgent, AgentEvent } from "@/lib/agent";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { nodeId?: string; natural_language_goal?: string; capabilities?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { nodeId, natural_language_goal, capabilities } = body;

  if (!nodeId || !natural_language_goal) {
    return jsonError("nodeId and natural_language_goal are required", 400);
  }

  const db = getSupabaseAdmin();
  const { data: fleet, error } = await db
    .from("fleets")
    .select("id, api_url, credentials, device_name, status")
    .eq("id", nodeId)
    .single();

  if (error || !fleet) {
    return jsonError("Node not found", 404);
  }

  const creds = fleet.credentials as { username?: string; access_key?: string } | null;
  if (!creds?.username || !creds?.access_key) {
    return jsonError("Node has no credentials configured", 422);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonError("ANTHROPIC_API_KEY is not configured on the server", 500);
  }

  // Mark node Busy before starting
  await db
    .from("fleets")
    .update({ status: "Busy", updated_at: new Date().toISOString() })
    .eq("id", nodeId);

  const device = new AppiumDevice(fleet.api_url, creds.username, creds.access_key);
  const llm = new ClaudeLLM(apiKey);

  const sessionCaps: Record<string, unknown> = capabilities ?? {
    platformName: "Android",
    "appium:automationName": "UiAutomator2",
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        for await (const event of runAgent(natural_language_goal, device, llm, sessionCaps)) {
          send(event);
        }
      } finally {
        await db
          .from("fleets")
          .update({ status: "Online", updated_at: new Date().toISOString() })
          .eq("id", nodeId)
          .then(() => {}, () => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
