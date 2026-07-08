import { headers } from "next/headers";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req: NextRequest) {
  headers(); // force dynamic rendering
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { min_xp, max_xp, title_name, sort_order } = await req.json();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("level_titles_pool")
    .insert({ min_xp, max_xp, title_name, sort_order: sort_order ?? 0 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ level: data });
}
