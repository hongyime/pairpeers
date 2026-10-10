import { Suspense } from "react";
import { AdminContent } from "./content";

export const metadata = { title: "Admin · PairPeers" };

/** Shell prerenders statically; the founder check reads the session (dynamic). */
export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="centered">
          <div className="card">
            <div className="eyebrow">Admin</div>
            <h1>Bot status</h1>
            <p className="muted">Loading…</p>
          </div>
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
