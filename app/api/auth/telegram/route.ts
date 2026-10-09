import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
} from "@/lib/session";
import { telegramUserSummary, verifyTelegramIdToken } from "@/lib/telegram";
import { ensureProfile } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NONCE_COOKIE } from "./nonce/route";

const NONCE_COOKIE_PATH = "/api/auth/telegram";

/** The one-time nonce is consumed on every exit — success or failure. */
function clearNonce(res: NextResponse): NextResponse {
  res.cookies.delete({ name: NONCE_COOKIE, path: NONCE_COOKIE_PATH });
  return res;
}

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
    return clearNonce(
      NextResponse.json({ error: "invalid_json" }, { status: 400 })
    );
  }
  if (typeof idToken !== "string" || !idToken) {
    return clearNonce(
      NextResponse.json({ error: "missing_id_token" }, { status: 400 })
    );
  }

  // Replay protection: the nonce is validated inside JWT verification (jose
  // `nonce` option), so the check cannot be accidentally skipped.
  // NOTE (accepted risk, pilot): nonce consumption is cookie deletion. Two
  // concurrent requests with the same token+nonce could both pass — but that
  // only lets a user double-submit their own login. A server-side one-time
  // nonce store is the hardening path if this ever matters.
  const expectedNonce = req.cookies.get(NONCE_COOKIE)?.value;
  if (!expectedNonce) {
    return clearNonce(
      NextResponse.json({ error: "nonce_mismatch" }, { status: 401 })
    );
  }

  let payload;
  try {
    payload = await verifyTelegramIdToken(idToken, clientId, expectedNonce);
  } catch (e) {
    // Temporary diagnostic: surface the exact jose failure so real-world
    // login issues (popup vs in-app browsers) can be root-caused.
    const reason =
      e instanceof Error ? `${e.name}: ${e.message}` : "unknown_error";
    console.error(`[auth] popup id_token verification failed: ${reason}`);
    return clearNonce(
      NextResponse.json({ error: "invalid_token", reason }, { status: 401 })
    );
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    return clearNonce(
      NextResponse.json({ error: "server_misconfigured" }, { status: 500 })
    );
  }

  // TODO: upsert the user into Supabase `profiles` (keyed on telegram_id = payload.id).
  const user = telegramUserSummary(payload);

  // One Telegram identity = one profile, forever (Sybil defense).
  try {
    const supabase = await createSupabaseServerClient();
    await ensureProfile(supabase, payload.id, user.name ?? user.username);
  } catch {
    return clearNonce(
      NextResponse.json({ error: "db_error" }, { status: 500 })
    );
  }

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
  return clearNonce(res);
}
