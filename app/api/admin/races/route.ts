import { headers } from "next/headers";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET() {
  headers(); // force dynamic rendering
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("races")
    .select("*, distances(id)")
    .order("race_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ races: data });
}

export async function POST(req: NextRequest) {
  headers(); // force dynamic rendering
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("races")
    .insert({
      name: body.name,
      race_date: body.race_date || null,
      logo_url: body.logo_url || null,
      route_map_url: body.route_map_url || null,
      location: body.location || null,
      official_link: body.official_link || null,
      timezone: body.timezone || "Asia/Bangkok",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ race: data });
}
