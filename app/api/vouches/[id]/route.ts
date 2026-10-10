import { NextRequest, NextResponse } from "next/server";
import { getSessionTelegramId } from "@/lib/auth";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  approveVoucherName,
  hideVouch,
  removeVouch,
} from "@/lib/vouches";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (typeof body.voucher_name_approved === "boolean") {
    const result = await approveVoucherName(
      supabase,
      id,
      profile.id,
      body.voucher_name_approved
    );
    if (!result.ok) {
      const status =
        result.error === "not_found"
          ? 404
          : result.error === "forbidden"
          ? 403
          : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true, vouch: result.vouch });
  }

  if (typeof body.hidden === "boolean") {
    const result = await hideVouch(supabase, id, profile.id, body.hidden);
    if (!result.ok) {
      const status =
        result.error === "not_found"
          ? 404
          : result.error === "forbidden"
          ? 403
          : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true, vouch: result.vouch });
  }

  return NextResponse.json({ error: "invalid_body" }, { status: 400 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const telegramId = await getSessionTelegramId(req);
  if (!telegramId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const result = await removeVouch(supabase, id, profile.id);
  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "forbidden"
        ? 403
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
