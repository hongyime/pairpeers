import { requireFounderSession } from "@/lib/adminAuth";
import { StatusChecks } from "./controls";

/** Founder-only admin content: reads the session, so it renders dynamically. */
export async function AdminContent() {
  await requireFounderSession();

  return (
    <main className="centered">
      <div className="card">
        <div className="eyebrow">Admin</div>
        <h1>Bot status</h1>
        <p className="muted">
          Read-only health checks for @pairpeersbot. Founder-only.
        </p>
        <StatusChecks />
      </div>
    </main>
  );
}
