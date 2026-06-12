import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type Params = { nodeId: string; path: string[] };

const STRIPPED_REQ_HEADERS = new Set(["host", "authorization", "content-length"]);
const STRIPPED_RES_HEADERS = new Set(["transfer-encoding", "connection"]);

async function proxyRequest(
  req: NextRequest,
  { params }: { params: Params }
) {
  const { nodeId, path } = params;

  const { data: fleet, error } = await getSupabaseAdmin()
    .from("fleets")
    .select("id, api_url, credentials")
    .eq("id", nodeId)
    .single();

  if (error || !fleet) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  // Build the upstream WebDriver URL, preserving query params
  const reqUrl = new URL(req.url);
  const base = fleet.api_url.replace(/\/$/, "");
  const targetUrl = `${base}/${path.join("/")}${reqUrl.search}`;

  // Forward all request headers except those we replace
  const forwardHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (!STRIPPED_REQ_HEADERS.has(key.toLowerCase())) {
      forwardHeaders[key] = value;
    }
  });

  // Inject stored credentials server-side — never echoed to the client
  const creds = fleet.credentials as { username?: string; access_key?: string } | null;
  if (creds?.username && creds?.access_key) {
    const token = Buffer.from(`${creds.username}:${creds.access_key}`).toString("base64");
    forwardHeaders["Authorization"] = `Basic ${token}`;
  }

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.text() : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });

    const responseBody = await upstream.text();

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!STRIPPED_RES_HEADERS.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upstream unreachable";
    return NextResponse.json(
      { status: 13, value: { message: msg } },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
