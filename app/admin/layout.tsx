import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireFounderSession } from "@/lib/adminAuth";

export const metadata: Metadata = {
  title: "Admin · PairPeers",
};

async function FounderGate({ children }: { children: React.ReactNode }) {
  await requireFounderSession();
  return <>{children}</>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="page-shell section">
      <header
        style={{
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "1rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.875rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--primary)",
              fontWeight: 600,
            }}
          >
            PairPeers Admin
          </span>
        </div>
        <nav style={{ display: "flex", gap: "1.25rem", fontSize: "0.95rem" }}>
          <Link href="/admin">Status</Link>
          <Link href="/admin/pool">Pool</Link>
          <Link href="/admin/metrics">Metrics</Link>
          <Link href="/admin/safety">Safety</Link>
        </nav>
      </header>
      <Suspense fallback={<p className="muted">Verifying admin access…</p>}>
        <FounderGate>{children}</FounderGate>
      </Suspense>
    </div>
  );
}
