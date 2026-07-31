import { NextRequest, NextResponse } from "next/server";

export function requireAdmin(req: NextRequest): NextResponse | null {
  const isLoggedIn = req.cookies.get("trail_admin_auth")?.value === "ok";
  if (!isLoggedIn) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return null;
}
