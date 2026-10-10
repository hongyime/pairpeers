"use client";

import { useEffect, useState } from "react";
import type { PoolMetrics } from "@/lib/poolMetrics";

export function PoolMonitor() {
  const [data, setData] = useState<PoolMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pool");
      if (!res.ok) {
        throw new Error(`Failed to load pool metrics (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return <p className="muted">Loading pool metrics...</p>;
  }

  if (error) {
    return (
      <div className="card">
        <p style={{ color: "#b91c1c" }}>{error}</p>
        <button className="btn secondary" onClick={load} style={{ marginTop: "1rem" }}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p className="muted" style={{ margin: 0 }}>
          Current candidate pool status and algorithm readiness.
        </p>
        <button className="btn secondary" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Threshold Documentation Banner */}
      <div
        style={{
          background: "var(--tint-purple)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: "1rem 1.25rem",
          fontSize: "0.875rem",
        }}
      >
        <strong style={{ color: "var(--primary)" }}>Monitor only:</strong> Threshold alerts are advisory and do not halt matching. A warning triggers when any single identity bucket exceeds 70% of the eligible pool, or when the eligible-pair ratio drops below 50% of participants.
      </div>

      {/* Warnings List */}
      {data.warnings.length > 0 && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: "var(--radius-card)",
            padding: "1rem 1.25rem",
          }}
        >
          <div style={{ fontWeight: 600, color: "#991B1B", marginBottom: "0.5rem" }}>
            Advisory warnings ({data.warnings.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#991B1B", fontSize: "0.9rem" }}>
            {data.warnings.map((w, idx) => (
              <li key={idx} style={{ marginBottom: "0.25rem" }}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Overview Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
        <div className="card" style={{ padding: "1.25rem" }}>
          <div className="eyebrow">Eligible Pool</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ink)" }}>
            {data.eligiblePoolSize}
          </div>
          <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
            Total registered: {data.totalParticipants} ({data.excludedCount} excluded)
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem" }}>
          <div className="eyebrow">Eligible Pairs</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ink)" }}>
            {data.eligiblePairCount}
          </div>
          <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
            Pair ratio: {Math.round(data.pairRatio * 100)}% (min: 50%)
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem" }}>
          <div className="eyebrow">Max Identity Share</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ink)" }}>
            {Math.round(data.maxIdentityShare * 100)}%
          </div>
          <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
            Dominant: {data.dominantIdentityBucket ?? "none"} (max: 70%)
          </div>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        {/* Identity Buckets */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <h3>Identity distribution</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
            {Object.entries(data.identityBuckets).map(([key, count]) => {
              const pct = Math.round((data.identityShares[key] ?? 0) * 100);
              return (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                    <span style={{ textTransform: "capitalize" }}>{key.replace("_", " ")}</span>
                    <span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--primary)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Seeking Buckets */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <h3>Seeking preferences</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
            {Object.entries(data.seekingBuckets).map(([key, count]) => {
              const pct = Math.round((data.seekingShares[key] ?? 0) * 100);
              return (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                    <span style={{ textTransform: "capitalize" }}>Seeking {key}</span>
                    <span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--secondary)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historical Cycles Audit */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <h3>Historical cycle audits</h3>
        {data.history.length === 0 ? (
          <p className="muted" style={{ marginTop: "0.5rem" }}>No completed match cycles recorded yet.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: "1rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem" }}>Date</th>
                  <th style={{ padding: "0.5rem" }}>Pool size</th>
                  <th style={{ padding: "0.5rem" }}>Eligible pairs</th>
                  <th style={{ padding: "0.5rem" }}>Matched pairs</th>
                  <th style={{ padding: "0.5rem" }}>Algorithm</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((cycle) => (
                  <tr key={cycle.cycleId} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "0.5rem" }}>
                      {new Date(cycle.startedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{cycle.poolSize}</td>
                    <td style={{ padding: "0.5rem" }}>{cycle.eligiblePairCount}</td>
                    <td style={{ padding: "0.5rem" }}>{cycle.pairCount}</td>
                    <td style={{ padding: "0.5rem" }}>{cycle.algorithm ?? "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
