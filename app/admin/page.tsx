import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { WebhookControls } from "./controls";

export const metadata = { title: "Admin — PairPeers" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const session =
    token && secret ? await verifySessionToken(token, secret) : null;
  const supabase = await createSupabaseServerClient();
  const profile = session?.telegramId
    ? await getProfileByTelegramId(supabase, session.telegramId)
    : null;
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
