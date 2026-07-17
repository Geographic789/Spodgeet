import { headers } from "next/headers";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  headers();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("races")
    .select("id, name, race_date, location, distances(id, label, distance_km, elevation_gain_m, start_time)")
    .eq("is_active", true)
    .order("race_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ races: data });
}
