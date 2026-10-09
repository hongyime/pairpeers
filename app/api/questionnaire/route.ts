import { mkdir, appendFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * STUB: accepts questionnaire answers and appends them to a local JSONL file.
 * TODO: replace with a Supabase upsert into `questionnaire_responses`
 * (keyed on the authenticated profile_id) once the DB is wired up.
 *
 * Defense in depth: the session is verified inside the handler, not only in
 * edge middleware, so a middleware matcher misconfiguration can never leave
 * this endpoint unprotected. Answers are tagged with the verified Telegram ID.
 */
export async function POST(req: NextRequest) {
  const sessionSecret = process.env.SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session =
    token && sessionSecret
      ? await verifySessionToken(token, sessionSecret)
      : null;
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const dir = "/tmp/pairpeers-questionnaires";
  await mkdir(dir, { recursive: true });
  const file = `${dir}/${Date.now()}.jsonl`;
  await appendFile(
    file,
    JSON.stringify({
      received_at: new Date().toISOString(),
      telegram_id: session.telegramId,
      answers: body,
    }) + "\n"
  );

  return NextResponse.json({ ok: true });
}
