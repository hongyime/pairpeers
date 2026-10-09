import { cookies } from "next/headers";
import Link from "next/link";
import TelegramLogin from "@/components/TelegramLogin";
import ClaimInviteButton from "./claim-button";
import { getInvitePreview } from "@/lib/invites";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const INVALID_COPY = {
  invalid_code: {
    title: "Invite not found",
    body: "This invite link doesn't match any invite. Check the link and try again.",
  },
  expired: {
    title: "Invite expired",
    body: "This invite is past its expiry. Ask your friend for a fresh one.",
  },
  already_redeemed: {
    title: "Already claimed",
    body: "This invite has already been claimed. Each invite works exactly once.",
  },
} as const;

/**
 * Public invite landing: validate → preview (inviter + vouch) → login →
 * redeem → onboard. Shows social proof before asking for login.
 */
export async function InviteContent({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.trim().toUpperCase();

  const supabase = await createSupabaseServerClient();
  let preview;
  try {
    preview = await getInvitePreview(supabase, code);
  } catch {
    preview = { valid: false as const, reason: "invalid_code" as const };
  }

  if (!preview.valid) {
    const copy = INVALID_COPY[preview.reason];
    return (
      <main className="centered">
        <div className="card narrow">
          <div className="eyebrow">Invite</div>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.body}</p>
          <p className="muted small">
            <Link href="/">← Back home</Link>
          </p>
        </div>
      </main>
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const loggedIn =
    !!secret && !!token && (await verifySessionToken(token, secret)) !== null;

  const expiry = new Date(preview.expires_at).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
  });

  return (
    <main className="centered">
      <div className="card narrow">
        <div className="eyebrow">You&apos;re invited</div>
        <h1>{preview.inviter_name} vouched for you</h1>
        <blockquote className="invite-vouch">“{preview.vouch_text}”</blockquote>
        <p className="muted small">
          Single-use invite · expires {expiry}
        </p>
        {loggedIn ? (
          <ClaimInviteButton code={code} />
        ) : (
          <>
            <div className="widget-wrap">
              <TelegramLogin redirectTo={`/invite/${code}`} />
            </div>
            <p className="muted small">
              Popup blocked?{" "}
              <a href={`/api/auth/telegram/redirect?next=/invite/${code}`}>
                Sign in via redirect instead
              </a>
              .
            </p>
          </>
        )}
        <p className="muted small">
          <Link href="/">← Back home</Link>
        </p>
      </div>
    </main>
  );
}
