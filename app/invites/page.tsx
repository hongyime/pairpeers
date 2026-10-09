import { Suspense } from "react";
import Link from "next/link";
import { InvitesDashboard } from "./dashboard";

/** Shell prerenders statically; the dashboard reads the session (dynamic). */
export default function InvitesPage() {
  return (
    <Suspense
      fallback={
        <main className="centered">
          <div className="card narrow">
            <div className="eyebrow">Invites</div>
            <h1>Invite friends</h1>
            <p className="muted">Loading…</p>
            <p className="muted small">
              <Link href="/">← Back home</Link>
            </p>
          </div>
        </main>
      }
    >
      <InvitesDashboard />
    </Suspense>
  );
}
