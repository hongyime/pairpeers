import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { deleteAccount } from "@/lib/accountData";
import { logEvent } from "@/lib/events";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const isConfirmed =
    body?.confirmation === "DELETE" ||
    body?.confirmation_token === "DELETE" ||
    body?.confirm === true;

  if (!isConfirmed) {
    return NextResponse.json(
      { error: "confirmation_required", message: "Please provide confirmation token 'DELETE' in request body." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  if ((profile as any).deleted_at) {
    const res = NextResponse.json({ ok: true, already_anonymized: true });
    res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/", httpOnly: true });
    return res;
  }

  const result = await deleteAccount(supabase, profile.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "deletion_failed" }, { status: 500 });
  }

  await logEvent({
    supabase,
    eventType: "account_anonymized",
    actorProfileId: profile.id,
    metadata: { reason: "user_requested" },
  });

  const res = NextResponse.json({ ok: true, message: "Account successfully anonymized." });
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/", httpOnly: true });
  return res;
}
