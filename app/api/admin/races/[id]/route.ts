import { headers } from "next/headers";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  headers(); // force dynamic rendering
  const sb = supabaseAdmin();
  const { data: race, error: raceErr } = await sb
    .from("races")
    .select("*")
    .eq("id", params.id)
    .single();
  if (raceErr) return NextResponse.json({ error: raceErr.message }, { status: 404 });

  const { data: distances, error: distErr } = await sb
    .from("distances")
    .select("*")
    .eq("race_id", params.id)
    .order("distance_km", { ascending: true });
  if (distErr) return NextResponse.json({ error: distErr.message }, { status: 500 });

  return NextResponse.json({ race, distances });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  headers(); // force dynamic rendering
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("races")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ race: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  headers(); // force dynamic rendering
  const denied = requireAdmin(req);
  if (denied) return denied;

  const sb = supabaseAdmin();
  const { error } = await sb.from("races").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
