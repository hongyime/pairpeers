import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // reject logins older than 24h

/**
 * Verifies the Telegram Login widget payload per
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * data_check_string = "k=v" lines for every field except `hash`,
 * sorted alphabetically, joined with "\n".
 * secret_key = SHA256(bot_token); check = HMAC_SHA256(secret_key, data_check_string).
 */
function verifyTelegramAuth(params: URLSearchParams, botToken: string): boolean {
  const receivedHash = params.get("hash");
  if (!receivedHash) return false;

  const pairs: Array<[string, string]> = [];
  params.forEach((value, key) => {
    if (key !== "hash") pairs.push([key, value]);
  });
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(expectedHash, "utf8");
  const b = Buffer.from(receivedHash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const params = req.nextUrl.searchParams;
  if (!verifyTelegramAuth(params, botToken)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // Reject stale logins (replay protection).
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) {
    return NextResponse.json({ error: "stale_auth" }, { status: 401 });
  }

  // TODO: upsert the user into Supabase `profiles` (keyed on telegram_id)
  // and establish a session (e.g. Supabase Auth custom token / signed cookie).
  const user: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key !== "hash") user[key] = value;
  });

  return NextResponse.json({ ok: true, user });
}
