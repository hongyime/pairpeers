import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { listVoucheeVouches, listVoucherVouches } from "@/lib/vouches";
import { VouchesManager } from "./VouchesManager";

export default function VouchesPage() {
  return (
    <Suspense
      fallback={
        <main className="centered">
          <div className="card narrow">
            <div className="eyebrow">Vouches</div>
            <h1>Your vouches</h1>
            <p className="muted">Loading…</p>
            <p className="muted small">
              <Link href="/">← Back home</Link>
            </p>
          </div>
        </main>
      }
    >
      <VouchesContent />
    </Suspense>
  );
}

async function VouchesContent() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const telegramId =
    secret && token ? (await verifySessionToken(token, secret))?.telegramId ?? null : null;
  if (!telegramId) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile?.is_member) redirect("/");

  const received = await listVoucheeVouches(supabase, profile.id);
  const given = await listVoucherVouches(supabase, profile.id);

  return (
    <main className="centered">
      <div className="card">
        <div className="eyebrow">Vouches</div>
        <h1>Manage your vouches</h1>
        <p className="muted">
          Control which references appear on your profile, and manage name consent for references you wrote.
        </p>
        <VouchesManager initialReceived={received} initialGiven={given} />
        <p className="muted small" style={{ marginTop: "24px" }}>
          <Link href="/invites">Manage invites</Link> · <Link href="/">Back home</Link>
        </p>
      </div>
    </main>
  );
}
