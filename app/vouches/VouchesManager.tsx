"use client";

import { useState } from "react";
import type { Vouch } from "@/lib/vouches";

export function VouchesManager({
  initialReceived,
  initialGiven,
}: {
  initialReceived: Vouch[];
  initialGiven: Vouch[];
}) {
  const [received, setReceived] = useState<Vouch[]>(initialReceived);
  const [given, setGiven] = useState<Vouch[]>(initialGiven);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleToggleHide(id: string, currentHidden: boolean) {
    setLoadingId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/vouches/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hidden: !currentHidden }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Could not update visibility.");
        return;
      }
      setReceived((prev) =>
        prev.map((v) =>
          v.id === id
            ? { ...v, hidden_at: !currentHidden ? new Date().toISOString() : null }
            : v
        )
      );
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm("Are you sure you want to remove this vouch permanently?")) {
      return;
    }
    setLoadingId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/vouches/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Could not remove vouch.");
        return;
      }
      setReceived((prev) => prev.filter((v) => v.id !== id));
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleToggleNameConsent(id: string, currentApproved: boolean) {
    setLoadingId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/vouches/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voucher_name_approved: !currentApproved }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Could not update name consent.");
        return;
      }
      setGiven((prev) =>
        prev.map((v) =>
          v.id === id ? { ...v, voucher_name_approved: !currentApproved } : v
        )
      );
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      {errorMsg && (
        <p className="status" role="alert" style={{ marginBottom: "1rem" }}>
          {errorMsg}
        </p>
      )}

      <section style={{ marginBottom: "2rem" }}>
        <h2>References on your profile</h2>
        {received.length === 0 ? (
          <p className="muted small">
            You do not have any references yet. Friends who invite you write a reference.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
            {received.map((v) => {
              const isHidden = v.hidden_at !== null;
              const voucherName = v.voucher_name_approved
                ? v.voucher?.display_name || "A friend"
                : "A friend (Name anonymous)";

              return (
                <li
                  key={v.id}
                  style={{
                    padding: "1rem",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    background: isHidden ? "rgba(0,0,0,0.02)" : "transparent",
                    opacity: isHidden ? 0.75 : 1,
                  }}
                >
                  <blockquote
                    style={{
                      margin: "0 0 0.5rem 0",
                      fontStyle: "italic",
                      fontSize: "1.05rem",
                    }}
                  >
                    &ldquo;{v.text}&rdquo;
                  </blockquote>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                    }}
                  >
                    <div className="small muted">
                      By <strong>{voucherName}</strong>
                      {v.relationship_label ? ` · ${v.relationship_label}` : ""}
                      {isHidden ? " · (Hidden from profile)" : " · (Visible)"}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="chip-btn"
                        disabled={loadingId === v.id}
                        onClick={() => handleToggleHide(v.id, isHidden)}
                      >
                        {isHidden ? "Show on profile" : "Hide from profile"}
                      </button>
                      <button
                        type="button"
                        className="chip-btn"
                        style={{ color: "#991b1b" }}
                        disabled={loadingId === v.id}
                        onClick={() => handleRemove(v.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2>References you have written</h2>
        {given.length === 0 ? (
          <p className="muted small">
            You have not written any references yet. Create an invite to vouch for a friend.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
            {given.map((v) => (
              <li
                key={v.id}
                style={{
                  padding: "1rem",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                }}
              >
                <blockquote
                  style={{
                    margin: "0 0 0.5rem 0",
                    fontStyle: "italic",
                    fontSize: "1.05rem",
                  }}
                >
                  &ldquo;{v.text}&rdquo;
                </blockquote>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div className="small muted">
                    Relationship: {v.relationship_label || "Friend"} ·{" "}
                    {v.voucher_name_approved
                      ? "Your name is shown"
                      : "Your name is kept anonymous"}
                  </div>
                  <button
                    type="button"
                    className="chip-btn"
                    disabled={loadingId === v.id}
                    onClick={() => handleToggleNameConsent(v.id, v.voucher_name_approved)}
                  >
                    {v.voucher_name_approved ? "Keep anonymous" : "Show my name"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
