"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TmaShell, useTma } from "../tma-shell";
import {
  canSubmitFeedback,
  getMatchStatusLabel,
  type TmaMatch,
} from "@/lib/tmaMatches";

function TmaMatchesContent() {
  const { haptic } = useTma();
  const [matches, setMatches] = useState<TmaMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-match action states
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [scheduleInputs, setScheduleInputs] = useState<Record<string, string>>({});
  const [showSchedule, setShowSchedule] = useState<Record<string, boolean>>({});
  const [feedbackRatings, setFeedbackRatings] = useState<Record<string, boolean | null>>({});
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) {
        throw new Error(`Failed to load matches (${res.status})`);
      }
      const data = await res.json();
      setMatches(data.matches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load matches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleOptIn(matchId: string, action: "accept" | "decline") {
    setActionLoading((prev) => ({ ...prev, [matchId]: true }));
    try {
      const res = await fetch(`/api/matches/${matchId}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        haptic("error");
        alert(data.error ?? "Action failed.");
        return;
      }
      haptic(action === "accept" ? "success" : "light");
      await load();
    } catch {
      haptic("error");
      alert("Network error. Please try again.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [matchId]: false }));
    }
  }

  async function handleDateAction(
    matchId: string,
    newStatus: "scheduled" | "happened" | "skipped" | "not_planned",
    scheduledVal?: string
  ) {
    setActionLoading((prev) => ({ ...prev, [matchId]: true }));
    try {
      const body: Record<string, string> = { status: newStatus };
      if (newStatus === "scheduled" && scheduledVal) {
        body.scheduled_at = new Date(scheduledVal).toISOString();
      }
      const res = await fetch(`/api/matches/${matchId}/date`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        haptic("error");
        alert(data.error ?? "Could not update date status.");
        return;
      }
      haptic("success");
      setShowSchedule((prev) => ({ ...prev, [matchId]: false }));
      await load();
    } catch {
      haptic("error");
      alert("Network error. Please try again.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [matchId]: false }));
    }
  }

  async function handleFeedbackSubmit(matchId: string) {
    const rating = feedbackRatings[matchId];
    if (rating === undefined || rating === null) {
      alert("Please select whether you would meet again.");
      return;
    }

    setActionLoading((prev) => ({ ...prev, [matchId]: true }));
    try {
      const res = await fetch(`/api/matches/${matchId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          would_meet_again: rating,
          note: feedbackNotes[matchId]?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        haptic("error");
        alert(data.error ?? "Could not submit feedback.");
        return;
      }
      haptic("success");
      await load();
    } catch {
      haptic("error");
      alert("Network error. Please try again.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [matchId]: false }));
    }
  }

  if (loading) {
    return <p className="status-line">Loading your matches…</p>;
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "1rem" }}>
        <p className="status">{error}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            haptic("light");
            load();
          }}
          style={{ marginTop: "1rem" }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "1rem" }}>
        <p className="muted">
          No introductions yet. Once a matching cycle runs and you are paired, your
          introduction will appear here.
        </p>
        <Link
          href="/tma"
          className="btn secondary"
          style={{ marginTop: "1.5rem" }}
          onClick={() => haptic()}
        >
          Back to menu
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {matches.map((m) => {
        const isBusy = Boolean(actionLoading[m.id]);
        const isEligibleForFeedback = canSubmitFeedback(m.date.status);
        const hasSubmittedFeedback = Boolean(m.feedback);
        const currentRating = feedbackRatings[m.id] ?? m.feedback?.would_meet_again ?? null;
        const currentNote = feedbackNotes[m.id] ?? m.feedback?.note ?? "";

        return (
          <div
            key={m.id}
            style={{
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-card)",
              padding: "1rem",
              background: "var(--card-bg)",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--primary)" }}>
                  {getMatchStatusLabel(m.status, m.my_response)}
                </strong>
                {m.status === "pending" && (
                  <p className="muted small" style={{ marginTop: "0.2rem" }}>
                    You have 72 hours to opt in mutually.
                  </p>
                )}
                {m.status === "declined" && (
                  <p className="muted small" style={{ marginTop: "0.2rem" }}>
                    This introduction did not work out.
                  </p>
                )}
                {m.status === "expired" && (
                  <p className="muted small" style={{ marginTop: "0.2rem" }}>
                    This introduction expired before mutual opt-in.
                  </p>
                )}
              </div>

              {m.status === "pending" && m.my_response === "accepted" && (
                <span className="pill pill-active">Accepted by you</span>
              )}
              {m.status === "accepted" && <span className="pill pill-active">Connected</span>}
            </div>

            {/* Rationale presentation */}
            <div
              style={{
                background: "var(--tint-purple)",
                borderRadius: "6px",
                padding: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                fontSize: "0.875rem",
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: "var(--primary)" }}>Shared interests: </span>
                <span>{m.rationale.sharedInterestsText}</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: "var(--primary)" }}>Complementary strength: </span>
                <span>{m.rationale.complementaryTrait}</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: "var(--primary)" }}>Honest difference: </span>
                <span>{m.rationale.honestDifference}</span>
              </div>
            </div>

            {/* Pending actions */}
            {m.status === "pending" && m.my_response !== "accepted" && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn"
                  disabled={isBusy}
                  onClick={() => handleOptIn(m.id, "accept")}
                  style={{ flex: 1 }}
                >
                  {isBusy ? "Saving…" : "Accept introduction"}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={isBusy}
                  onClick={() => handleOptIn(m.id, "decline")}
                  style={{ flex: 1 }}
                >
                  {isBusy ? "Saving…" : "Decline"}
                </button>
              </div>
            )}

            {/* Mutually accepted state: Contact reveal */}
            {m.status === "accepted" && (
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  padding: "0.75rem",
                  background: "#FAFAFA",
                }}
              >
                <strong>Contact details</strong>
                {m.contact?.telegram_username ? (
                  <p style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}>
                    Connect on Telegram:{" "}
                    <a
                      href={`https://t.me/${m.contact.telegram_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => haptic("light")}
                    >
                      @{m.contact.telegram_username}
                    </a>
                  </p>
                ) : (
                  <p className="muted small" style={{ marginTop: "0.25rem" }}>
                    Your match has not set a public Telegram username yet.
                  </p>
                )}
                <p className="muted small" style={{ marginTop: "0.5rem", fontSize: "0.75rem" }}>
                  Safety note: Choose a public place and let a friend know where you are going.
                </p>
              </div>
            )}

            {/* Date coordination & check-in */}
            {m.status === "accepted" && (
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  padding: "0.75rem",
                }}
              >
                <strong>Date check-in</strong>
                <div style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}>
                  {m.date.status === "not_planned" && (
                    <p className="muted small">Have not met yet. Plan a time or record what happened.</p>
                  )}
                  {m.date.status === "scheduled" && m.date.scheduled_at && (
                    <div>
                      <p className="small" style={{ color: "var(--primary)", fontWeight: 600 }}>
                        Date scheduled for{" "}
                        {new Date(m.date.scheduled_at).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {m.date.venue_text && (
                        <p className="muted small" style={{ marginTop: "0.2rem" }}>
                          Venue: <strong>{m.date.venue_text}</strong>
                        </p>
                      )}
                    </div>
                  )}
                  {m.date.status === "happened" && (
                    <p className="small" style={{ color: "#166534", fontWeight: 600 }}>
                      Date completed. You can leave private feedback below.
                    </p>
                  )}
                  {m.date.status === "skipped" && (
                    <p className="small" style={{ color: "#991b1b", fontWeight: 600 }}>
                      Date was skipped or cancelled. You can leave private feedback below.
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                  {m.date.status !== "happened" && (
                    <button
                      type="button"
                      className="chip-btn"
                      disabled={isBusy}
                      onClick={() => handleDateAction(m.id, "happened")}
                    >
                      We met up
                    </button>
                  )}
                  {m.date.status !== "skipped" && (
                    <button
                      type="button"
                      className="chip-btn"
                      disabled={isBusy}
                      onClick={() => handleDateAction(m.id, "skipped")}
                    >
                      Did not happen
                    </button>
                  )}
                  {m.date.status !== "scheduled" && m.date.status !== "happened" && (
                    <button
                      type="button"
                      className="chip-btn"
                      disabled={isBusy}
                      onClick={() => {
                        haptic("light");
                        setShowSchedule((prev) => ({ ...prev, [m.id]: !prev[m.id] }));
                      }}
                    >
                      {showSchedule[m.id] ? "Cancel" : "Set a date"}
                    </button>
                  )}
                  {(m.date.status === "happened" || m.date.status === "skipped") && (
                    <button
                      type="button"
                      className="chip-btn"
                      disabled={isBusy}
                      onClick={() => handleDateAction(m.id, "not_planned")}
                    >
                      Reset status
                    </button>
                  )}
                </div>

                {showSchedule[m.id] && (
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="datetime-local"
                      value={scheduleInputs[m.id] ?? ""}
                      onChange={(e) =>
                        setScheduleInputs((prev) => ({ ...prev, [m.id]: e.target.value }))
                      }
                      style={{ padding: "0.3rem", borderRadius: "4px", border: "1px solid var(--line)" }}
                    />
                    <button
                      type="button"
                      className="chip-btn"
                      disabled={isBusy || !scheduleInputs[m.id]}
                      onClick={() =>
                        handleDateAction(m.id, "scheduled", scheduleInputs[m.id])
                      }
                    >
                      Save date
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Private feedback */}
            {m.status === "accepted" && (
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  padding: "0.75rem",
                }}
              >
                <strong>Private feedback</strong>
                {!isEligibleForFeedback ? (
                  <p className="muted small" style={{ marginTop: "0.25rem" }}>
                    Private feedback unlocks after your date has happened or was skipped.
                  </p>
                ) : hasSubmittedFeedback ? (
                  <p className="muted small" style={{ marginTop: "0.25rem" }}>
                    Thank you for submitting private feedback. Your notes help improve future pairings.
                  </p>
                ) : (
                  <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <p className="muted small">
                      Would you meet again? Strictly private and never shown to your match.
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="chip-btn"
                        data-active={currentRating === true}
                        onClick={() => {
                          haptic("light");
                          setFeedbackRatings((prev) => ({ ...prev, [m.id]: true }));
                        }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className="chip-btn"
                        data-active={currentRating === false}
                        onClick={() => {
                          haptic("light");
                          setFeedbackRatings((prev) => ({ ...prev, [m.id]: false }));
                        }}
                      >
                        No
                      </button>
                    </div>

                    <div>
                      <label htmlFor={`feedback-note-${m.id}`} className="small">
                        Private note (optional)
                      </label>
                      <textarea
                        id={`feedback-note-${m.id}`}
                        value={currentNote}
                        onChange={(e) =>
                          setFeedbackNotes((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        placeholder="Anything the organizers should know (private)"
                        style={{ width: "100%", marginTop: "0.25rem" }}
                      />
                    </div>

                    <div>
                      <button
                        type="button"
                        className="chip-btn"
                        disabled={isBusy || currentRating === null}
                        onClick={() => handleFeedbackSubmit(m.id)}
                      >
                        {isBusy ? "Saving…" : "Send private feedback"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TmaMatchesPage() {
  return (
    <TmaShell title="Your matches">
      <TmaMatchesContent />
    </TmaShell>
  );
}
