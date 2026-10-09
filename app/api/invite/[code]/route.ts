import { NextRequest, NextResponse } from "next/server";
import { getInvitePreview } from "@/lib/invites";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * Public invite preview: inviter display name, vouch text, expiry — nothing else.
 * Unauthenticated by design (the visitor has no account yet).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const rl = rateLimit(`invite:preview:${clientIp(_req)}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();
  let preview;
  try {
    preview = await getInvitePreview(supabase, code);
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json(preview);
}
