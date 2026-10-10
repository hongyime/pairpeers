"use client";

import { useEffect, useState } from "react";
import type { FounderMetricsResult } from "@/lib/events";

export function MetricsDashboard() {
  const [data, setData] = useState<FounderMetricsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/metrics");
      if (!res.ok) {
        throw new Error(`Failed to load metrics (${res.status})`);
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
    return <p className="muted">Loading founder metrics...</p>;
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
          High level funnel, conversion rates, and cycle history.
        </p>
        <button className="btn secondary" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {/* Funnel Card */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <div className="eyebrow">Questionnaire Funnel</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ink)" }}>
            {Math.round(data.funnel.completionRate * 100)}%
          </div>
          <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            {data.funnel.questionnaireCompleted} of {data.funnel.members} members completed ({data.funnel.totalProfiles} total profiles)
          </div>
        </div>

        {/* Acceptance Card */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <div className="eyebrow">Match Acceptance Rate</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ink)" }}>
            {Math.round(data.matches.acceptanceRate * 100)}%
          </div>
          <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            {data.matches.accepted} accepted, {data.matches.declined} declined, {data.matches.expired} expired ({data.matches.pending} pending)
          </div>
        </div>

        {/* Date Outcomes Card */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <div className="eyebrow">Date Outcomes</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ink)" }}>
            {data.dates.happened}
          </div>
          <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            {data.dates.happened} happened, {data.dates.scheduled} scheduled, {data.dates.skipped} skipped
          </div>
        </div>

        {/* Feedback Card */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <div className="eyebrow">Would Meet Again</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ink)" }}>
            {Math.round(data.feedback.meetAgainRate * 100)}%
          </div>
          <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            {data.feedback.wouldMeetAgain} of {data.feedback.total} reviews positive ({Math.round(data.feedback.responseRate * 100)}% response rate)
          </div>
        </div>
      </div>

      {/* Recent Cycles Table */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <h3>Matching cycle performance</h3>
        {data.cycles.length === 0 ? (
          <p className="muted" style={{ marginTop: "0.5rem" }}>No matching cycles recorded yet.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: "1rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem" }}>Date</th>
                  <th style={{ padding: "0.5rem" }}>Eligible pool</th>
                  <th style={{ padding: "0.5rem" }}>Pairs made</th>
                  <th style={{ padding: "0.5rem" }}>Algorithm path</th>
                </tr>
              </thead>
              <tbody>
                {data.cycles.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "0.5rem" }}>
                      {new Date(c.startedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{c.poolSize}</td>
                    <td style={{ padding: "0.5rem" }}>{c.pairCount}</td>
                    <td style={{ padding: "0.5rem" }}>{c.algorithm ?? "n/a"}</td>
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
