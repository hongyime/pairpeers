import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="centered">
      <div className="card">
        <div className="eyebrow">Privacy</div>
        <h1>Privacy Policy</h1>
        <p className="muted small">Last updated: October 2026</p>

        <section style={{ marginTop: "1.5rem" }}>
          <h2>1. What we collect</h2>
          <p>
            We collect your verified Telegram identity (user ID, display name, username), your responses
            to the questionnaire, and references written by you and your friends.
          </p>
        </section>

        <section style={{ marginTop: "1rem" }}>
          <h2>2. How we use your data</h2>
          <p>
            Your questionnaire answers power our matching algorithm. We do not sell your data, we do not
            run ads, and we do not track you across other services.
          </p>
        </section>

        <section style={{ marginTop: "1rem" }}>
          <h2>3. What is shared with matches</h2>
          <p>
            When an introduction is made, your match sees compatibility rationales based on your preferences.
            Your Telegram handle is kept strictly private until both of you mutually accept the introduction.
          </p>
        </section>

        <section style={{ marginTop: "1rem" }}>
          <h2>4. References and names</h2>
          <p>
            You have full control over references on your profile. You can hide or remove references at any
            time. Your friend&apos;s name appears only if they explicitly approve sharing it.
          </p>
        </section>

        <section style={{ marginTop: "1rem" }}>
          <h2>5. Data retention and deletion</h2>
          <p>
            You can export your complete data or delete your account at any time through our account endpoints.
            Deletion permanently wipes your answers and personal identifiers.
          </p>
        </section>

        <p className="muted small" style={{ marginTop: "2rem" }}>
          <Link href="/">Back to home</Link> · <Link href="/terms">Terms of Service</Link>
        </p>
      </div>
    </main>
  );
}
