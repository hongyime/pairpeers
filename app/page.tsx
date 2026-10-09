import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="page-shell hero-copy">
          <h1>
            Vouched,
            <br />
            not swiped.
          </h1>
          <p className="hero-lede">
            Invite-only dating through friends who know you best.
          </p>
          <div className="actions">
            <Link href="/login" className="btn">Sign in with Telegram</Link>
            <a href="#how-it-works" className="btn secondary">How it works</a>
          </div>
          <p className="status-line">Now onboarding for the pilot.</p>
        </div>
      </section>

      <section className="value-strip">
        <div className="page-shell value-grid">
          <article className="value-card">
            <h3>One match at a time</h3>
            <p>No feeds. One person, properly considered.</p>
          </article>
          <article className="value-card">
            <h3>Private by default</h3>
            <p>Your profile is shown to your match only.</p>
          </article>
          <article className="value-card">
            <h3>Vouched by friends</h3>
            <p>People who know you write your introduction.</p>
          </article>
        </div>
      </section>

      <section id="how-it-works" className="section">
        <div className="page-shell">
          <div className="section-heading">
            <h2>How it works</h2>
            <p>From a friend&apos;s invite to a real date.</p>
          </div>
          <div className="steps">
            <article className="step-card"><span className="step-number">01</span><h3>Invite</h3><p>It starts with someone who knows you.</p></article>
            <article className="step-card"><span className="step-number">02</span><h3>Vouch</h3><p>Friends write your reference, in their own words.</p></article>
            <article className="step-card"><span className="step-number">03</span><h3>Questionnaire</h3><p>You tell us what matters, and your dealbreakers.</p></article>
            <article className="step-card"><span className="step-number">04</span><h3>One match</h3><p>One compatible introduction at a time.</p></article>
            <article className="step-card"><span className="step-number">05</span><h3>Date</h3><p>Mutual interest? You decide what to share.</p></article>
          </div>
        </div>
      </section>

      <section className="section trust-section">
        <div className="page-shell">
          <div className="section-heading">
            <h2>Thoughtful by design.</h2>
            <p>No black boxes. No surprises.</p>
          </div>
          <div className="trust-grid">
            <article className="trust-card">
              <h3>The algorithm</h3>
              <strong>Stable matching. The same math behind medical residency placements.</strong>
              <p>It finds a pairing that works for both people. Not a popularity contest.</p>
            </article>
            <article className="trust-card">
              <h3>Your privacy</h3>
              <strong>Your answers stay private.</strong>
              <p>Nothing is sold. Nothing is shared beyond your match. Contact details only if you both agree.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section closing">
        <div className="page-shell section-heading">
          <h2>Start with a little trust.</h2>
          <p>Ask a friend for an invite.</p>
          <div className="actions"><Link href="/login" className="btn">Sign in with Telegram</Link></div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="page-shell">
          <span className="footer-brand">PairPeers</span>
          <span className="muted small">© 2026 · Vouched, not swiped.</span>
        </div>
      </footer>
    </main>
  );
}
