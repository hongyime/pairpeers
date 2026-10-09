import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export const NONCE_COOKIE = "pp_tg_nonce";
const NONCE_TTL_SECONDS = 5 * 60; // long enough to complete the popup flow

/**
 * Issues a one-time nonce for the Telegram OIDC popup flow.
 * The nonce is stored in an httpOnly cookie and echoed back inside the
 * signed id_token — the verify route rejects tokens whose nonce mismatches,
 * which binds the login to this browser session (replay protection).
 */
export async function GET() {
  const nonce = randomBytes(32).toString("hex");
  const res = NextResponse.json({ nonce });
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth/telegram",
    maxAge: NONCE_TTL_SECONDS,
  });
  return res;
}
