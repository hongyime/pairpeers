import { Suspense } from "react";
import Link from "next/link";
import { MatchesContent } from "./content";

export const metadata = { title: "My matches · PairPeers" };

/** Shell prerenders statically; the match list reads the session (dynamic). */
export default function MatchesPage() {
  return (
    <Suspense
      fallback={
        <main className="centered">
          <div className="card narrow">
            <div className="eyebrow">Matches</div>
            <h1>My matches</h1>
            <p className="muted">Loading…</p>
            <p className="muted small">
              <Link href="/">← Back home</Link>
            </p>
          </div>
        </main>
      }
    >
      <MatchesContent />
    </Suspense>
  );
}
