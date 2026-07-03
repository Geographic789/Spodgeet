export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const sb = supabaseAdmin();
  const { error } = await sb.from("comments_pool").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
