import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
} from "@/lib/session";
import { validateTelegramInitData } from "@/lib/telegramMiniApp";
import { ensureProfile } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * Validates Telegram Mini App initData signature and establishes a session.
 *
 * Telegram signs the raw `Telegram.WebApp.initData` string using HMAC-SHA-256
 * derived from TELEGRAM_BOT_TOKEN.
 *
 * On success:
 * - Ensures a profile row exists via `ensureProfile` (Telegram ID = identity)
 * - Sets the signed `pp_session` cookie (identical to website login)
 * - Returns `{ ok: true }`
 */
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("initData" in body) ||
    typeof (body as { initData: unknown }).initData !== "string" ||
    !(body as { initData: string }).initData
  ) {
    return NextResponse.json({ error: "missing_init_data" }, { status: 400 });
  }

  const rawInitData = (body as { initData: string }).initData;
  const validation = validateTelegramInitData(rawInitData, botToken);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 401 });
  }

  const user = validation.data.user;
  const displayName =
    [user.first_name, user.last_name]
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .join(" ")
      .trim() ||
    user.username ||
    null;

  try {
    const supabase = await createSupabaseServerClient();
    await ensureProfile(
      supabase,
      user.id,
      displayName,
      user.username ?? null
    );
  } catch (err) {
    console.error("[auth] miniapp ensureProfile failed:", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: displayName,
      username: user.username ?? null,
    },
  });

  // Issue the same pp_session cookie as the website login
  res.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(user.id, sessionSecret),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    }
  );

  return res;
}
