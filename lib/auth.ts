import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session.ts";

/**
 * Verifies the session inside the handler (defense in depth — never rely
 * solely on edge middleware for route security).
 */
export async function getSessionTelegramId(
  req: NextRequest
): Promise<number | null> {
  const secret = process.env.SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!secret || !token) return null;
  const session = await verifySessionToken(token, secret);
  return session?.telegramId ?? null;
}
