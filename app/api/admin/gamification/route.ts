import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const sb = supabaseAdmin();
  const [{ data: levels }, { data: comments }] = await Promise.all([
    sb.from("level_titles_pool").select("*").order("min_xp"),
    sb.from("comments_pool").select("*").order("trigger_condition"),
  ]);
  return NextResponse.json({ levels, comments });
}
