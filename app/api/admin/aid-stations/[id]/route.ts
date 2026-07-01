import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("aid_stations")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ aidStation: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const sb = supabaseAdmin();
  const { error } = await sb.from("aid_stations").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
