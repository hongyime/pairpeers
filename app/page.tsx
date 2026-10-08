import Link from "next/link";

export default function Home() {
  return (
    <main className="centered">
      <div className="card">
        <div className="eyebrow">PairPeers</div>
        <h1 className="gradient">Vouched, not swiped.</h1>
        <p>
          An invite-only way to meet someone new — through the friends who know
          you best.
        </p>
        <p className="muted">
          One thoughtful match at a time. No endless scrolling. Your friends
          vouch you in, write your references, and the matching engine does the
          rest.
        </p>
        <div className="actions">
          <Link href="/login" className="btn">Sign in with Telegram</Link>
          <Link href="/questionnaire" className="btn secondary">Try the questionnaire</Link>
        </div>
        <div className="badge">Invite-only pilot · Coming soon</div>
      </div>
    </main>
  );
}
