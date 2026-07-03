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
    .from("distances")
    .insert({
      race_id: body.race_id,
      label: body.label,
      distance_km: body.distance_km,
      elevation_gain_m: body.elevation_gain_m ?? null,
      elevation_loss_m: body.elevation_loss_m ?? null,
      gpx_filename: body.gpx_filename ?? null,
      route_geojson: body.route_geojson ?? null,
      mandatory_gear: body.mandatory_gear ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ distance: data });
}
