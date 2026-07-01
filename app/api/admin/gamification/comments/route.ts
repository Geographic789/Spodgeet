import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { trigger_condition, comment_text } = await req.json();
  if (!trigger_condition || !comment_text) {
    return NextResponse.json({ error: "trigger_condition and comment_text required." }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("comments_pool")
    .insert({ trigger_condition, comment_text })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data });
}
