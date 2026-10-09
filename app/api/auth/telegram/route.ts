import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
} from "@/lib/session";
import { telegramUserSummary, verifyTelegramIdToken } from "@/lib/telegram";
import { NONCE_COOKIE } from "./nonce/route";

/**
 * Verifies a Telegram OIDC id_token from the telegram-login.js popup flow.
 * See https://core.telegram.org/bots/telegram-login
 */
export async function POST(req: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_TELEGRAM_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  let idToken: unknown;
  try {
    ({ id_token: idToken } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "missing_id_token" }, { status: 400 });
  }

  let payload;
  try {
    payload = await verifyTelegramIdToken(idToken, clientId);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  // Replay protection: the token must carry the nonce we issued to this browser.
  // NOTE (accepted risk, pilot): nonce consumption is cookie deletion. Two
  // concurrent requests with the same token+nonce could both pass — but that
  // only lets a user double-submit their own login. A server-side one-time
  // nonce store is the hardening path if this ever matters.
  const expectedNonce = req.cookies.get(NONCE_COOKIE)?.value;
  if (!expectedNonce || payload.nonce !== expectedNonce) {
    return NextResponse.json({ error: "nonce_mismatch" }, { status: 401 });
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // TODO: upsert the user into Supabase `profiles` (keyed on telegram_id = payload.id).
  const user = telegramUserSummary(payload);

  const res = NextResponse.json({ ok: true, user });
  // Establish the session: signed, httpOnly, Secure, SameSite=Lax.
  res.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(payload.id, sessionSecret),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    }
  );
  // Delete the one-time nonce with the same path it was set with.
  res.cookies.delete({ name: NONCE_COOKIE, path: "/api/auth/telegram" });
  return res;
}
