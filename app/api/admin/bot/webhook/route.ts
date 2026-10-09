import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * POST /api/admin/bot/webhook — register the Telegram webhook for
 * @pairpeersbot (setWebhook), or report its current status with
 * `?action=info` (getWebhookInfo).
 *
 * Auth: Vercel Cron (`Authorization: Bearer <CRON_SECRET>`) or a founder
 * session. Requires TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET
 * (server-only). The token never leaves the server: Telegram is called
 * from here, and only the result is returned.
 */
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!botToken || !webhookSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const cronOk =
    !!cronSecret &&
    req.headers.get("authorization") === `Bearer ${cronSecret}`;

  if (!cronOk) {
    const supabase = await createSupabaseServerClient();
    const telegramId = await getSessionTelegramId(req);
    const profile = telegramId
      ? await getProfileByTelegramId(supabase, telegramId)
      : null;
    if (!profile?.is_founder) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const action = req.nextUrl.searchParams.get("action") ?? "set";
  const method =
    action === "info"
      ? "getWebhookInfo"
      : action === "menu_button"
        ? "getChatMenuButton"
        : "setWebhook";

  const params: Record<string, string> = {};
  if (method === "setWebhook") {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://pairpeers.hong-yi.me";
    params.url = `${base.replace(/\/$/, "")}/api/bot/webhook`;
    params.secret_token = webhookSecret;
    params.drop_pending_updates = "true";
  }

  let tgRes: Response;
  try {
    tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/${method}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
      }
    );
  } catch {
    return NextResponse.json({ error: "telegram_unreachable" }, { status: 502 });
  }

  let data: unknown;
  try {
    data = await tgRes.json();
  } catch {
    return NextResponse.json({ error: "telegram_bad_response" }, { status: 502 });
  }
  return NextResponse.json({ ok: tgRes.ok, telegram: data }, { status: tgRes.ok ? 200 : 502 });
}
