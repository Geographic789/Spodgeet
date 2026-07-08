import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const isLoggedIn = req.cookies.get("trail_admin_auth")?.value === "ok";
  const isLoginPage = req.nextUrl.pathname.startsWith("/admin/login");

  if (!isLoggedIn && !isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/races";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
