import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import CreateInviteForm from "./create-form";
import { INVITES_PER_USER } from "@/lib/inviteConstants";
import { listMyInvites } from "@/lib/invites";
import { getProfileByTelegramId } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://pairpeers.hong-yi.me";

/**
 * Member invite dashboard: create invites (with atomic vouch) and see
 * existing codes. Only vouched members can invite — the friends-of-friends
 * guarantee.
 */
export async function InvitesDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const telegramId =
    secret && token ? (await verifySessionToken(token, secret))?.telegramId ?? null : null;
  if (!telegramId) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const profile = await getProfileByTelegramId(supabase, telegramId);
  if (!profile?.is_member) {
    return (
      <main className="centered">
        <div className="card narrow">
          <div className="eyebrow">Invites</div>
          <h1>Members only</h1>
          <p className="muted">
            Only vouched members can invite friends. Claim an invite first —
            ask a friend for their link.
          </p>
          <p className="muted small">
            <Link href="/">← Back home</Link>
          </p>
        </div>
      </main>
    );
  }

  const invites = await listMyInvites(supabase, profile.id);
  const invitesLeft = INVITES_PER_USER - invites.length;

  return (
    <main className="centered">
      <div className="card narrow">
        <div className="eyebrow">Invites</div>
        <h1>Invite friends</h1>
        <p className="muted">
          {invitesLeft > 0
            ? `You have ${invitesLeft} of ${INVITES_PER_USER} pilot invites left.`
            : `You've used all ${INVITES_PER_USER} pilot invites.`}{" "}
          Each invite is single-use and expires in 3 days.
        </p>
        <CreateInviteForm invitesLeft={invitesLeft} />
        {invites.length > 0 && (
          <>
            <h2>Your invites</h2>
            <ul className="invite-list">
              {invites.map((inv) => {
                const expired = new Date(inv.expires_at) <= new Date();
                const used = inv.uses >= inv.max_uses;
                const status = used ? "claimed" : expired ? "expired" : "active";
                return (
                  <li key={inv.code} className={`invite-row invite-${status}`}>
                    <code>{inv.code}</code>
                    <span className="muted small">{status}</span>
                    {!used && !expired && (
                      <a
                        href={`${baseUrl}/invite/${inv.code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="muted small"
                      >
                        open link
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="muted small">
          <Link href="/">← Back home</Link>
        </p>
      </div>
    </main>
  );
}
