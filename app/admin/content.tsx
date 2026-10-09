import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { WebhookControls } from "./controls";

/** Founder-only admin content: reads the session, so it renders dynamically. */
export async function AdminContent() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const telegramId =
    secret && token
      ? (await verifySessionToken(token, secret))?.telegramId ?? null
      : null;
  if (!telegramId) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile?.is_founder) redirect("/login");

  return (
    <main className="centered">
      <div className="card">
        <div className="eyebrow">Admin</div>
        <h1>Bot webhook</h1>
        <p className="muted">
          Register @pairpeersbot&apos;s webhook or check its current status.
          Founder-only.
        </p>
        <WebhookControls />
      </div>
    </main>
  );
}
