export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_req: NextRequest, { params }: { params: { planId: string } }) {
  const sb = supabaseAdmin();

  const { data: plan, error: planErr } = await sb
    .from("user_plans")
    .select("*")
    .eq("id", params.planId)
    .single();

  if (planErr) {
    // Try share token lookup
    const { data: byToken, error: tokenErr } = await sb
      .from("user_plans")
      .select("*")
      .eq("share_token", params.planId)
      .single();
    if (tokenErr) return NextResponse.json({ error: "Plan not found." }, { status: 404 });
    return buildPlanResponse(byToken, sb);
  }

  return buildPlanResponse(plan, sb);
}

async function buildPlanResponse(plan: any, sb: any) {
  const { data: distance } = await sb
    .from("distances")
    .select("id, label, distance_km, elevation_gain_m, elevation_loss_m, race_id")
    .eq("id", plan.distance_id)
    .single();

  const { data: race } = distance
    ? await sb
        .from("races")
        .select("id, name, race_date, timezone")
        .eq("id", distance.race_id)
        .single()
    : { data: null };

  return NextResponse.json({ plan, distance, race });
}

export async function PATCH(req: NextRequest, { params }: { params: { planId: string } }) {
  const body = await req.json();
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("user_plans")
    .update({
      pacing_table: body.pacing_table,
      notes: body.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.planId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}
