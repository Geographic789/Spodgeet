import { headers } from "next/headers";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_req: NextRequest, { params }: { params: { planId: string } }) {
  headers();
  const sb = supabaseAdmin();

  let plan: any = null;

  const { data: byId } = await sb.from("user_plans").select("*").eq("id", params.planId).single();
  if (byId) {
    plan = byId;
  } else {
    const { data: byToken } = await sb.from("user_plans").select("*").eq("share_token", params.planId).single();
    if (!byToken) return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    plan = byToken;
  }

  const { data: distance } = await sb
    .from("distances")
    .select("id, label, distance_km, elevation_gain_m, elevation_loss_m, route_geojson, race_id")
    .eq("id", plan.distance_id)
    .single();

  const { data: race } = distance
    ? await sb.from("races").select("id, name, race_date, timezone").eq("id", distance.race_id).single()
    : { data: null };

  const { data: aidStations } = distance
    ? await sb.from("aid_stations").select("id, name, cumulative_km, cutoff_time")
        .eq("distance_id", distance.id).order("cumulative_km")
    : { data: [] };

  return NextResponse.json({ plan, distance, race, aidStations: aidStations || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: { planId: string } }) {
  headers();
  const body = await req.json();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("user_plans")
    .update({ pacing_table: body.pacing_table, notes: body.notes, updated_at: new Date().toISOString() })
    .eq("id", params.planId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}
