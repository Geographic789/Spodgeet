export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { processRaceResult, type RaceResultInput } from "@/lib/xpEngine";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    plan_id,
    status,
    overall_rank,
    gender_rank,
    age_group_rank,
    total_finishers,
    top_100,
    actual_distance_km,
    actual_elevation_gain_m,
    pace_delta_min,
  } = body;

  if (!plan_id || !status) {
    return NextResponse.json({ error: "plan_id and status are required." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // Load levels + comments
  const [{ data: levels }, { data: comments }] = await Promise.all([
    sb.from("level_titles_pool").select("*").order("min_xp"),
    sb.from("comments_pool").select("*"),
  ]);

  const input: RaceResultInput = {
    status,
    overall_rank: overall_rank || null,
    gender_rank: gender_rank || null,
    age_group_rank: age_group_rank || null,
    total_finishers: total_finishers || null,
    top_100: !!top_100,
    actual_distance_km: Number(actual_distance_km) || 0,
    actual_elevation_gain_m: Number(actual_elevation_gain_m) || 0,
    pace_delta_min: pace_delta_min != null ? Number(pace_delta_min) : null,
  };

  const result = processRaceResult(input, levels || [], comments || []);

  // Upsert (one result per plan)
  const { data: saved, error } = await sb
    .from("race_results")
    .upsert(
      {
        user_plan_id: plan_id,
        status,
        overall_rank: input.overall_rank,
        gender_rank: input.gender_rank,
        age_group_rank: input.age_group_rank,
        total_finishers: input.total_finishers,
        top_100: input.top_100,
        xp_earned: result.xp_earned,
      },
      { onConflict: "user_plan_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ result: saved, computed: result });
}
