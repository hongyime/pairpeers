/**
 * Telegram profile sync via the Bot API.
 * getChat returns the CURRENT first_name/last_name/username for a user the
 * bot knows (our users authenticate through @pairpeersbot and grant the
 * `write` scope, so the bot can reach them).
 * NOTE: the Bot API never exposes phone numbers — those only refresh at
 * login time, when the user shares them via the `phone` scope.
 */

export type TelegramChatInfo = {
  displayName: string | null;
  username: string | null;
};

export async function fetchTelegramChat(
  botToken: string,
  telegramId: number
): Promise<TelegramChatInfo | null> {
  let res: Response;
  try {
    res = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${telegramId}`,
      { signal: AbortSignal.timeout(15_000) }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }
  const result = (body as { ok?: boolean; result?: Record<string, unknown> })
    ?.result;
  if (!result || result.type !== "private") return null;
  const first = typeof result.first_name === "string" ? result.first_name : "";
  const last = typeof result.last_name === "string" ? result.last_name : "";
  const displayName = [first, last].filter(Boolean).join(" ") || null;
  const username =
    typeof result.username === "string" ? result.username : null;
  return { displayName, username };
}
