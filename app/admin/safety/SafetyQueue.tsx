"use client";

import { useEffect, useState } from "react";

type ReportItem = {
  id: string;
  category: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolution_notes: string | null;
  created_at: string;
  match_id: string | null;
  reporter?: { id: string; display_name: string | null; telegram_username: string | null };
  reported?: { id: string; display_name: string | null; telegram_username: string | null; is_banned: boolean };
};

type InviteItem = {
  id: string;
  code: string;
  vouch_text: string | null;
  uses: number;
  max_uses: number;
  expires_at: string;
  inviter?: { id: string; display_name: string | null; telegram_username: string | null; is_banned?: boolean };
};

export function SafetyQueue() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolution form state for active report
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<"reviewing" | "resolved" | "dismissed">("resolved");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [banUser, setBanUser] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter === "all" ? "/api/admin/safety" : `/api/admin/safety?status=${statusFilter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load safety queue (${res.status})`);
      const json = await res.json();
      setReports(json.reports ?? []);
      setInvites(json.invites ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function handleResolve(reportId: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/safety", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          report_id: reportId,
          status: resolutionStatus,
          resolution_notes: resolutionNotes,
          ban_profile: banUser,
        }),
      });
      if (!res.ok) throw new Error("Could not update report status");
      setActiveReportId(null);
      setResolutionNotes("");
      setBanUser(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleProfileBan(profileId: string, currentBanned: boolean) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/safety", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          banned: !currentBanned,
        }),
      });
      if (!res.ok) throw new Error("Could not update member ban status");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Safety Reports Section */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2>Safety Reports Queue</h2>
            <p className="muted small">Review incoming user reports and manage ban actions.</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["all", "open", "reviewing", "resolved", "dismissed"].map((s) => (
              <button
                key={s}
                type="button"
                className="chip-btn"
                data-active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="muted" style={{ marginTop: "1rem" }}>Loading reports...</p>}
        {error && <p className="status" style={{ marginTop: "1rem" }}>{error}</p>}

        {!loading && reports.length === 0 && (
          <p className="muted" style={{ marginTop: "1.5rem" }}>No reports found for this filter.</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
          {reports.map((rep) => {
            const isBanned = Boolean(rep.reported?.is_banned);
            return (
              <div
                key={rep.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-card)",
                  padding: "1rem",
                  background: rep.status === "open" ? "#FFFBEB" : "var(--card-bg)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--primary)", textTransform: "capitalize" }}>
                      {rep.category}
                    </span>{" "}
                    <span className="muted small" style={{ marginLeft: "0.5rem" }}>
                      {new Date(rep.created_at).toLocaleString()}
                    </span>
                    <div style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
                      Reporter: {rep.reporter?.display_name ?? "Anonymous"} (@{rep.reporter?.telegram_username ?? "no_username"})
                    </div>
                    <div style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
                      Reported user: {rep.reported?.display_name ?? "Unknown"} (@{rep.reported?.telegram_username ?? "no_username"})
                      {isBanned && (
                        <span style={{ marginLeft: "0.5rem", color: "#b91c1c", fontWeight: 600 }}>
                          [BANNED]
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    style={{
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      background:
                        rep.status === "open"
                          ? "#FEE2E2"
                          : rep.status === "resolved"
                          ? "#DCFCE7"
                          : "#F3F4F6",
                      color:
                        rep.status === "open"
                          ? "#991B1B"
                          : rep.status === "resolved"
                          ? "#166534"
                          : "var(--body)",
                    }}
                  >
                    {rep.status}
                  </span>
                </div>

                {rep.details && (
                  <div style={{ marginTop: "0.75rem", fontSize: "0.9rem", background: "white", padding: "0.5rem 0.75rem", borderRadius: "4px", border: "1px solid var(--line)" }}>
                    {rep.details}
                  </div>
                )}

                {rep.resolution_notes && (
                  <div className="muted small" style={{ marginTop: "0.5rem" }}>
                    Resolution note: {rep.resolution_notes}
                  </div>
                )}

                {/* Action triggers */}
                <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  {activeReportId === rep.id ? (
                    <div style={{ width: "100%", marginTop: "0.5rem", background: "var(--tint-purple)", padding: "1rem", borderRadius: "6px" }}>
                      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <label style={{ fontSize: "0.85rem" }}>Status:</label>
                        {(["reviewing", "resolved", "dismissed"] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            className="chip-btn"
                            data-active={resolutionStatus === st}
                            onClick={() => setResolutionStatus(st)}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      <textarea
                        placeholder="Resolution notes (internal)"
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
                      />

                      <div style={{ marginBottom: "0.75rem" }}>
                        <label style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <input
                            type="checkbox"
                            checked={banUser}
                            onChange={(e) => setBanUser(e.target.checked)}
                          />
                          Ban reported member (excludes from future cycles and invalidates unused invites)
                        </label>
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn"
                          disabled={actionLoading}
                          onClick={() => handleResolve(rep.id)}
                        >
                          Save resolution
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={actionLoading}
                          onClick={() => setActiveReportId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() => {
                          setActiveReportId(rep.id);
                          setResolutionNotes(rep.resolution_notes ?? "");
                          setBanUser(isBanned);
                        }}
                      >
                        Resolve / Review
                      </button>

                      {rep.reported?.id && (
                        <button
                          type="button"
                          className="chip-btn"
                          disabled={actionLoading}
                          onClick={() => toggleProfileBan(rep.reported!.id, isBanned)}
                        >
                          {isBanned ? "Unban member" : "Ban member"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invites & Audit Chain Section */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <h2>Invite Chain and Audit</h2>
        <p className="muted small">Audit invite propagation. Unused invites from banned members are automatically rejected on claim.</p>

        <div style={{ overflowX: "auto", marginTop: "1rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem" }}>Code</th>
                <th style={{ padding: "0.5rem" }}>Inviter</th>
                <th style={{ padding: "0.5rem" }}>Uses</th>
                <th style={{ padding: "0.5rem" }}>Expires</th>
                <th style={{ padding: "0.5rem" }}>Inviter status</th>
                <th style={{ padding: "0.5rem" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const inviterBanned = Boolean(inv.inviter?.is_banned);
                return (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 600 }}>{inv.code}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {inv.inviter?.display_name ?? "Founder"} (@{inv.inviter?.telegram_username ?? "seed"})
                    </td>
                    <td style={{ padding: "0.5rem" }}>{inv.uses} / {inv.max_uses}</td>
                    <td style={{ padding: "0.5rem" }}>{new Date(inv.expires_at).toLocaleDateString()}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {inviterBanned ? (
                        <span style={{ color: "#b91c1c", fontWeight: 600 }}>Banned (invalidates code)</span>
                      ) : (
                        <span style={{ color: "#166534" }}>Active</span>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {inv.inviter?.id ? (
                        <button
                          type="button"
                          className="chip-btn"
                          disabled={actionLoading}
                          onClick={() => toggleProfileBan(inv.inviter!.id, inviterBanned)}
                        >
                          {inviterBanned ? "Unban" : "Ban"}
                        </button>
                      ) : (
                        <span className="muted small">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
