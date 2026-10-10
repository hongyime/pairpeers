import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="centered">
      <div className="card">
        <div className="eyebrow">Legal</div>
        <h1>Terms of Service</h1>
        <p className="muted small">Last updated: October 2026</p>

        <section style={{ marginTop: "1.5rem" }}>
          <h2>1. Welcome to PairPeers</h2>
          <p>
            PairPeers is an invite-only dating service built on trust and personal references.
            By using PairPeers, you agree to these simple terms.
          </p>
        </section>

        <section style={{ marginTop: "1rem" }}>
          <h2>2. Age requirement</h2>
          <p>
            You must be at least 18 years old to join PairPeers. We require explicit self-declaration
            of adult age before questionnaire completion and matching.
          </p>
        </section>

        <section style={{ marginTop: "1rem" }}>
          <h2>3. Vouching and accountability</h2>
          <p>
            Every member is vouched for by a friend. Your reputation and your friend&apos;s reputation
            are connected. Be honest in your profile and references.
          </p>
        </section>

        <section style={{ marginTop: "1rem" }}>
          <h2>4. Community standards and safety</h2>
          <p>
            Harassment, hate speech, impersonation, and non-consensual sharing of personal contact
            information are strictly prohibited. Violating these standards results in an immediate ban.
          </p>
        </section>

        <section style={{ marginTop: "1rem" }}>
          <h2>5. Safe dating</h2>
          <p>
            When meeting in person, always choose a public venue and let friends or family know
            your plans. You are responsible for your own safety and interactions.
          </p>
        </section>

        <p className="muted small" style={{ marginTop: "2rem" }}>
          <Link href="/">Back to home</Link> · <Link href="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </main>
  );
}
