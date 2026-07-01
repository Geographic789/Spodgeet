import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { processRaceResult } from "@/lib/xpEngine";

export async function GET(_req: NextRequest, { params }: { params: { planId: string } }) {
  const sb = supabaseAdmin();

  const { data: result, error } = await sb
    .from("race_results")
    .select("*")
    .eq("user_plan_id", params.planId)
    .single();

  if (error) return NextResponse.json({ result: null });

  // Recompute display values (comments are random each load — that's intentional)
  const [{ data: levels }, { data: comments }] = await Promise.all([
    sb.from("level_titles_pool").select("*").order("min_xp"),
    sb.from("comments_pool").select("*"),
  ]);

  const computed = processRaceResult(
    {
      status: result.status,
      overall_rank: result.overall_rank,
      gender_rank: result.gender_rank,
      age_group_rank: result.age_group_rank,
      total_finishers: result.total_finishers,
      top_100: result.top_100,
      actual_distance_km: 0,
      actual_elevation_gain_m: 0,
      pace_delta_min: null,
    },
    levels || [],
    comments || []
  );

  // Override XP from stored value
  computed.xp_earned = result.xp_earned;

  return NextResponse.json({ result, computed });
}
