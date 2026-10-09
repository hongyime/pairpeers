import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="page-shell hero-copy">
          <div className="eyebrow">Invite-only pilot</div>
          <h1>Vouched, not swiped.</h1>
          <p className="hero-lede">
            Meet someone new through the friends who know you best — one thoughtful
            match at a time.
          </p>
          <div className="actions">
            <Link href="/login" className="btn">Sign in with Telegram</Link>
            <a href="#how-it-works" className="btn secondary">How it works</a>
          </div>
          <p className="status-line">Pilot now onboarding · Next match cycle: TBA</p>
        </div>
      </section>

      <section className="value-strip">
        <div className="page-shell value-grid">
          <article className="value-card">
            <h3>One match at a time</h3>
            <p>No endless scrolling. Space to actually get to know one person.</p>
          </article>
          <article className="value-card">
            <h3>Only your match sees your profile</h3>
            <p>Your introduction is private by default, not a public catalogue.</p>
          </article>
          <article className="value-card">
            <h3>Friends vouch you in</h3>
            <p>Real references add context no profile prompt can capture.</p>
          </article>
        </div>
      </section>

      <section id="how-it-works" className="section">
        <div className="page-shell">
          <div className="section-heading">
            <h2>How it works</h2>
            <p>A calmer path from a friend&apos;s invitation to a genuinely considered date.</p>
          </div>
          <div className="steps">
            <article className="step-card"><span className="step-number">01</span><h3>Invite</h3><p>A friend invites you into the pilot. It starts with someone who already knows you.</p></article>
            <article className="step-card"><span className="step-number">02</span><h3>Vouch</h3><p>Your friends share what makes you a good person to meet, in their own words.</p></article>
            <article className="step-card"><span className="step-number">03</span><h3>Questionnaire</h3><p>You tell us what matters to you, including the boundaries that should be respected.</p></article>
            <article className="step-card"><span className="step-number">04</span><h3>One match</h3><p>The matching engine considers fit and dealbreakers to introduce one person at a time.</p></article>
            <article className="step-card"><span className="step-number">05</span><h3>Date</h3><p>If the feeling is mutual, you decide together whether to share contact details and meet.</p></article>
          </div>
        </div>
      </section>

      <section className="section trust-section">
        <div className="page-shell">
          <div className="section-heading">
            <h2>Thoughtful by design.</h2>
            <p>Explainable matching and explicit consent keep the experience human.</p>
          </div>
          <figure className="vouch-card">
            <blockquote>&ldquo;They make every room feel more like home. You&apos;ll know exactly what I mean after one conversation.&rdquo;</blockquote>
            <figcaption>Samira · longtime friend</figcaption>
          </figure>
          <div className="trust-grid">
            <article className="trust-card">
              <h3>The algorithm</h3>
              <strong>Stable matching — the same math behind medical residency placements.</strong>
              <p>In plain words: it looks for a pairing that works for both people, not a popularity ranking.</p>
            </article>
            <article className="trust-card">
              <h3>Your privacy</h3>
              <strong>Your answers stay private.</strong>
              <p>Nothing is sold, nothing is shared beyond your match, and your contact details are shared only if you both say yes.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section closing">
        <div className="page-shell section-heading">
          <h2>Start with a little trust.</h2>
          <p>Join the pilot through the friends who would vouch for you.</p>
          <div className="actions"><Link href="/login" className="btn">Sign in with Telegram</Link></div>
        </div>
      </section>
    </main>
  );
}
