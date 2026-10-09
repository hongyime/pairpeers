import { NextRequest, NextResponse } from "next/server";
import { parseStartPayload } from "../../../../lib/botCommands";
import { getProfileByTelegramId } from "../../../../lib/profiles";
import { sendTelegramMessage } from "../../../../lib/botNotify";
import { createSupabaseServerClient } from "../../../../lib/supabaseServer";

type TelegramMessage = {
  chat?: { id?: number };
  from?: { id?: number; first_name?: string; username?: string };
  text?: string;
};

type TelegramUpdate = { message?: TelegramMessage };

function commandFor(text: string): string | null {
  const command = text.trim().split(/\s+/)[0]?.split("@")[0];
  return command === "/start" || command === "/match" || command === "/help"
    ? command
    : null;
}

function replyForStart(payload: string | null): string {
  if (payload) {
    return `Welcome to PairPeers! Claim your invite here: https://pairpeers.hong-yi.me/invite/${payload}`;
  }
  return "Welcome to PairPeers! I can share your invite and notify you when your match is ready.";
}

const HELP_TEXT = [
  "PairPeers commands:",
  "/start — get started or claim an invite",
  "/match — check your match status",
  "/help — show this help",
].join("\n");

async function replyForMatch(telegramId: number): Promise<string> {
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await getProfileByTelegramId(supabase, telegramId);
    if (!profile) return "I don’t have a PairPeers profile for you yet. Start on the website to join.";

    const { data: match, error } = await supabase
      .from("matches")
      .select("status")
      .or(`a_id.eq.${profile.id},b_id.eq.${profile.id}`)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !match) return "You’re in PairPeers — no match has been assigned yet.";
    return `Your current match status is: ${match.status}.`;
  } catch {
    return "I couldn’t check your match status right now. Please try again soon.";
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!secret || !token) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = update.message;
  const text = message?.text;
  const chatId = message?.chat?.id;
  if (!text || chatId === undefined) return NextResponse.json({ ok: true });

  const command = commandFor(text);
  if (!command) return NextResponse.json({ ok: true });

  let reply: string;
  if (command === "/start") reply = replyForStart(parseStartPayload(text));
  else if (command === "/help") reply = HELP_TEXT;
  else reply = await replyForMatch(message.from?.id ?? chatId);

  try {
    await sendTelegramMessage(chatId, reply);
  } catch {
    // Telegram retries failed webhooks. A fast acknowledgement prevents the
    // function from becoming a long-running retry loop for transient errors.
  }

  return NextResponse.json({ ok: true });
}
