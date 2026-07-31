import { headers } from "next/headers";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  headers();
  const sb = supabaseAdmin();

  // Fetch races
  const { data: races, error } = await sb
    .from("races")
    .select("id, name, race_date, location, status")
    .neq("status", "archived")
    .order("race_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch distances separately — resilient to missing columns
  const racesWithDistances = await Promise.all(
    (races || []).map(async (race) => {
      const { data: distances } = await sb
        .from("distances")
        .select("id, label, distance_km, elevation_gain_m, start_time")
        .eq("race_id", race.id)
        .order("sort_order", { ascending: true });
      return { ...race, distances: distances || [] };
    })
  );

  return NextResponse.json({ races: racesWithDistances });
}
