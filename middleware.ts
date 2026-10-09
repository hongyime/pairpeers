import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const config = {
  matcher: ["/questionnaire/:path*", "/api/questionnaire/:path*"],
};

/**
 * Gates authenticated routes behind the signed session cookie issued by
 * POST /api/auth/telegram. Pages redirect to /login; API routes get a 401.
 */
export async function middleware(req: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid =
    secret && token
      ? (await verifySessionToken(token, secret)) !== null
      : false;

  if (valid) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  return NextResponse.redirect(login);
}
