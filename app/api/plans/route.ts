import { headers } from "next/headers";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildInitialPacingTable, backCalculatePace } from "@/lib/pacingEngine";
import type { TrackPoint } from "@/lib/routeTypes";

export async function GET() {
  headers();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("user_plans")
    .select("id, user_name, plan_name, created_at, share_token, distance_id")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data });
}

export async function POST(req: NextRequest) {
  headers();
  const body = await req.json();
  const { distanceId, userName, planName, goalTimeStr } = body;

  if (!distanceId || !userName || !goalTimeStr) {
    return NextResponse.json({ error: "distanceId, userName, goalTimeStr are required." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const { data: distance, error: distErr } = await sb
    .from("distances")
    .select("id, distance_km, route_geojson, start_time")
    .eq("id", distanceId).single();
  if (distErr) return NextResponse.json({ error: distErr.message }, { status: 404 });

  const { data: aidStations } = await sb
    .from("aid_stations")
    .select("id, name, cumulative_km, cutoff_time")
    .eq("distance_id", distanceId)
    .order("cumulative_km");

  const points: TrackPoint[] = (distance.route_geojson as TrackPoint[]) || [];
  const totalKm = distance.distance_km;
  const startTime = distance.start_time || "06:00";
  const basePace = backCalculatePace(goalTimeStr, totalKm);

  const pacingTable = buildInitialPacingTable(
    aidStations || [], totalKm, points, startTime, basePace
  );

  const { data: plan, error: planErr } = await sb
    .from("user_plans")
    .insert({
      distance_id: distanceId,
      user_name: userName,
      plan_name: planName || "",
      pacing_table: pacingTable,
      notes: JSON.stringify({ startTime, goalTimeStr, basePaceMinPerKm: basePace }),
    })
    .select().single();

  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });
  return NextResponse.json({ plan });
}
