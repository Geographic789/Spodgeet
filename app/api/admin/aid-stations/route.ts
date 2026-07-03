export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("aid_stations")
    .insert({
      distance_id: body.distance_id,
      name: body.name,
      cumulative_km: body.cumulative_km,
      cutoff_time: body.cutoff_time ?? null,
      lat: body.lat ?? null,
      lon: body.lon ?? null,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ aidStation: data });
}
