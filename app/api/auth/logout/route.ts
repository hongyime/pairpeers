import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Logs the user out by deleting the session cookie.
 * Note: sessions are stateless HMAC tokens, so "logout" clears the browser
 * cookie; the token itself remains technically valid until its 30-day
 * expiry. Server-side revocation (token version in DB) is the follow-up
 * if per-device logout ever matters.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  return res;
}

export async function GET(req: NextRequest) {
  const home = req.nextUrl.clone();
  home.pathname = "/";
  home.search = "";
  const res = NextResponse.redirect(home);
  res.cookies.delete({ name: SESSION_COOKIE, path: "/" });
  return res;
}
