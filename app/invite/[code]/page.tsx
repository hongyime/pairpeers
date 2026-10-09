import { Suspense } from "react";
import Link from "next/link";
import { InviteContent } from "./content";

/**
 * Fully static shell; all runtime data (params, cookies, DB) resolves
 * inside the Suspense boundary.
 */
export default function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="centered">
          <div className="card narrow">
            <div className="eyebrow">Invite</div>
            <h1>Loading…</h1>
            <p className="muted small">
              <Link href="/">← Back home</Link>
            </p>
          </div>
        </main>
      }
    >
      <InviteContent params={params} />
    </Suspense>
  );
}
