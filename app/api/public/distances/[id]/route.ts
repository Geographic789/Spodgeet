export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = supabaseAdmin();

  const { data: distance, error: distErr } = await sb
    .from("distances")
    .select("id, label, distance_km, elevation_gain_m, elevation_loss_m, route_geojson, race_id")
    .eq("id", params.id)
    .single();
  if (distErr) return NextResponse.json({ error: distErr.message }, { status: 404 });

  const { data: race } = await sb
    .from("races")
    .select("id, name, route_map_url")
    .eq("id", distance.race_id)
    .single();

  const { data: aidStations, error: aidErr } = await sb
    .from("aid_stations")
    .select("id, name, cumulative_km, cutoff_time")
    .eq("distance_id", params.id)
    .order("cumulative_km", { ascending: true });
  if (aidErr) return NextResponse.json({ error: aidErr.message }, { status: 500 });

  return NextResponse.json({ distance, race, aidStations });
}
