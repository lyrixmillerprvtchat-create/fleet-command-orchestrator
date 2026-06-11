import { Fleet, FleetAction, ActionResult } from "@/types/fleet";

export async function executeAppiumAction(
  fleet: Fleet,
  action: FleetAction,
  params?: Record<string, unknown>
): Promise<ActionResult> {
  const { api_url, credentials } = fleet;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (credentials?.username && credentials?.access_key) {
    const token = Buffer.from(
      `${credentials.username}:${credentials.access_key}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${token}`;
  }

  try {
    switch (action) {
      case "launch_app":
        return await postAppiumCommand(api_url, headers, {
          desiredCapabilities: { ...(params as object) },
        });

      case "execute_task":
        return await postAppiumCommand(`${api_url}/execute`, headers, {
          script: params?.script ?? "",
          args: params?.args ?? [],
        });

      case "restart":
        return await postAppiumCommand(`${api_url}/session`, headers, {
          action: "restart",
        });

      case "screenshot":
        return await getAppiumResource(`${api_url}/screenshot`, headers);

      default:
        return { success: false, message: `Unknown action: ${action}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message: msg };
  }
}

async function postAppiumCommand(
  url: string,
  headers: Record<string, string>,
  body: object
): Promise<ActionResult> {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return {
    success: res.ok,
    message: res.ok ? "Command sent successfully" : `HTTP ${res.status}`,
    data,
  };
}

async function getAppiumResource(
  url: string,
  headers: Record<string, string>
): Promise<ActionResult> {
  const res = await fetch(url, { method: "GET", headers });
  const data = await res.json().catch(() => null);
  return {
    success: res.ok,
    message: res.ok ? "Resource fetched" : `HTTP ${res.status}`,
    data,
  };
}
