import { NextRequest, NextResponse } from "next/server";
import { requireFounder } from "@/lib/adminAuth";
import { fetchTelegramChat } from "@/lib/telegramSync";

/**
 * POST /api/admin/sync-telegram — refresh stored Telegram display names and
 * usernames from the Bot API (getChat). Catches renames between logins.
 *
 * Auth: Vercel Cron (`Authorization: Bearer <CRON_SECRET>`) or a founder
 * session. Requires TELEGRAM_BOT_TOKEN (server-only).
 *
 * NOTE: phone numbers are NOT available via the Bot API — those refresh at
 * login time through the `phone` scope.
 */
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: "bot_token_not_configured" },
      { status: 503 }
    );
  }

  const auth = await requireFounder(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { supabase } = auth;

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, telegram_id, display_name, telegram_username");
  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  let checked = 0;
  let updated = 0;
  let failed = 0;
  for (const p of profiles ?? []) {
    checked++;
    const chat = await fetchTelegramChat(botToken, p.telegram_id as number);
    if (!chat) {
      failed++;
    } else {
      const patch: Record<string, string | null> = {};
      if (chat.displayName && chat.displayName !== p.display_name)
        patch.display_name = chat.displayName;
      const username = chat.username ?? null;
      if (username !== (p.telegram_username as string | null))
        patch.telegram_username = username;
      if (Object.keys(patch).length > 0) {
        const { error: updErr } = await supabase
          .from("profiles")
          .update(patch)
          .eq("id", p.id);
        if (updErr) failed++;
        else updated++;
      }
    }
    // Gentle pacing against Bot API rate limits.
    await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({ checked, updated, failed });
}
