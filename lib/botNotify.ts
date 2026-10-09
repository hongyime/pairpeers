const TELEGRAM_API = "https://api.telegram.org/bot";

// Telegram allows bursts, but a small process-local delay avoids needless
// bursts when several notifications are sent by one warm function instance.
let previousSend = Promise.resolve();
const MIN_SEND_INTERVAL_MS = 40;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendTelegramMessage(telegramId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

  const send = previousSend.then(async () => {
    await wait(MIN_SEND_INTERVAL_MS);
    const response = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: telegramId, text }),
    });

    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed with HTTP ${response.status}`);
    }

    const result = (await response.json()) as { ok?: boolean; description?: string };
    if (!result.ok) {
      throw new Error(`Telegram sendMessage failed: ${result.description ?? "unknown error"}`);
    }
  });

  // Keep the pacing chain alive after an individual failed send.
  previousSend = send.catch(() => undefined);
  await send;
}
