import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const PUBLIC_API_PATHS = ["/api/admin/login", "/api/admin/logout"];
  const isProtectedApi =
    pathname.startsWith("/api/admin/") && !PUBLIC_API_PATHS.includes(pathname);

  if (pathname.startsWith("/admin/dashboard") || isProtectedApi) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySessionToken(token) : null;

    if (!session) {
      if (isProtectedApi) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      const loginUrl = new URL("/admin/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard/:path*", "/api/admin/:path*"],
};
