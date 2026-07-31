import { headers } from "next/headers";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  headers(); // force dynamic rendering
  const sb = supabaseAdmin();
  const { data: distance, error: distErr } = await sb
    .from("distances")
    .select("*")
    .eq("id", params.id)
    .single();
  if (distErr) return NextResponse.json({ error: distErr.message }, { status: 404 });

  const { data: aidStations, error: aidErr } = await sb
    .from("aid_stations")
    .select("*")
    .eq("distance_id", params.id)
    .order("cumulative_km", { ascending: true });
  if (aidErr) return NextResponse.json({ error: aidErr.message }, { status: 500 });

  return NextResponse.json({ distance, aidStations });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  headers(); // force dynamic rendering
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("distances")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ distance: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  headers(); // force dynamic rendering
  const denied = requireAdmin(req);
  if (denied) return denied;

  const sb = supabaseAdmin();
  const { error } = await sb.from("distances").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
