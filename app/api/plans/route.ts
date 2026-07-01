import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInitialPacingTable } from "@/lib/pacingEngine";
import type { TrackPoint } from "@/lib/routeTypes";

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("user_plans")
    .select("id, user_name, created_at, share_token, distances(id, label, races(id, name))")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { distanceId, userName, startTime, basePaceMinPerKm } = body;

  if (!distanceId || !userName || !startTime || !basePaceMinPerKm) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // Load distance + route + aid stations + fatigue tiers
  const { data: distance, error: distErr } = await sb
    .from("distances")
    .select("id, distance_km, route_geojson")
    .eq("id", distanceId)
    .single();
  if (distErr) return NextResponse.json({ error: distErr.message }, { status: 404 });

  const { data: aidStations } = await sb
    .from("aid_stations")
    .select("id, name, cumulative_km, cutoff_time")
    .eq("distance_id", distanceId)
    .order("cumulative_km", { ascending: true });

  const { data: tiers } = await sb
    .from("fatigue_tiers")
    .select("min_pct, max_pct, multiplier")
    .order("min_pct", { ascending: true });

  const fatigueTiers = (tiers || []).map((t) => ({
    minPct: t.min_pct,
    maxPct: t.max_pct,
    multiplier: t.multiplier,
  }));

  const points: TrackPoint[] = (distance.route_geojson as TrackPoint[]) || [];
  const totalKm = distance.distance_km;

  const pacingTable = buildInitialPacingTable(
    aidStations || [],
    totalKm,
    points,
    startTime,
    Number(basePaceMinPerKm),
    fatigueTiers.length > 0 ? fatigueTiers : undefined
  );

  const { data: plan, error: planErr } = await sb
    .from("user_plans")
    .insert({
      distance_id: distanceId,
      user_name: userName,
      pacing_table: pacingTable,
      notes: JSON.stringify({ startTime, basePaceMinPerKm }),
    })
    .select()
    .single();

  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });
  return NextResponse.json({ plan });
}
