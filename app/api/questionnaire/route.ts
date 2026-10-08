import { mkdir, appendFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";

/**
 * STUB: accepts questionnaire answers and appends them to a local JSONL file.
 * TODO: replace with a Supabase upsert into `questionnaire_responses`
 * (keyed on the authenticated profile_id) once auth + DB are wired up.
 */
export async function POST(req: NextRequest) {
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
    JSON.stringify({ received_at: new Date().toISOString(), answers: body }) + "\n"
  );

  return NextResponse.json({ ok: true, stored: file, note: "stub storage — see TODO in route" });
}
