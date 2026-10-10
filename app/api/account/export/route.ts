import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { exportAccountData } from "@/lib/accountData";
import { logEvent } from "@/lib/events";

export async function GET(req: NextRequest) {
  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile || (profile as any).deleted_at) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  try {
    const exportData = await exportAccountData(supabase, profile.id);

    await logEvent({
      supabase,
      eventType: "account_data_exported",
      actorProfileId: profile.id,
      metadata: { format: "json" },
    });

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="pairpeers-export-${profile.id.slice(0, 8)}.json"`,
      },
    });
  } catch (err) {
    console.error("[account:export] Failed to export account data:", err);
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
