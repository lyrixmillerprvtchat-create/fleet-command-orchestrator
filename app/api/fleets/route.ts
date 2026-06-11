import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("fleets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { device_name, api_url, status, tags, credentials } = body;

  if (!device_name || !api_url) {
    return NextResponse.json(
      { error: "device_name and api_url are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("fleets")
    .insert({
      device_name,
      api_url,
      status: status ?? "Offline",
      tags: tags ?? [],
      credentials: credentials ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
