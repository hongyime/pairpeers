"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchRationale } from "@/lib/matchRationale";

export type MatchItemProps = {
  id: string;
  initialStatus: "pending" | "accepted" | "declined" | "expired";
  initialMyResponse: "accepted" | "declined" | null;
  rationale: MatchRationale;
  contact: { telegram_username: string | null } | null;
  initialFeedback: { would_meet_again: boolean; note: string | null } | null;
};

export function MatchItem({
  id,
  initialStatus,
  initialMyResponse,
  rationale,
  contact,
  initialFeedback,
}: MatchItemProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [myResponse, setMyResponse] = useState(initialMyResponse);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Feedback state
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(Boolean(initialFeedback));
  const [wouldMeetAgain, setWouldMeetAgain] = useState<boolean | null>(
    initialFeedback ? initialFeedback.would_meet_again : null
  );
  const [feedbackNote, setFeedbackNote] = useState(initialFeedback?.note ?? "");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  async function handleAction(action: "accept" | "decline") {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/matches/${id}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setMyResponse(action === "accept" ? "accepted" : "declined");
      if (data.status) {
        setStatus(data.status);
      }
      router.refresh();
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (wouldMeetAgain === null) {
      setFeedbackError("Please choose whether you would meet again.");
      return;
    }

    setFeedbackLoading(true);
    setFeedbackError(null);
    try {
      const res = await fetch(`/api/matches/${id}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          would_meet_again: wouldMeetAgain,
          note: feedbackNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackError(data.error ?? "Could not submit feedback.");
        return;
      }
      setFeedbackSubmitted(true);
    } catch {
      setFeedbackError("Network error. Please try again.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <li className="match-card">
      <div className="match-header">
        <div>
          <div className="match-status-title">
            {status === "pending" && myResponse === "accepted" && "Waiting for match response"}
            {status === "pending" && myResponse !== "accepted" && "Introduction waiting for you"}
            {status === "accepted" && "Mutually accepted"}
            {status === "declined" && "Declined"}
            {status === "expired" && "Expired"}
          </div>
          {status === "pending" && (
            <p className="muted small">You have 72 hours to opt in mutually.</p>
          )}
          {status === "declined" && (
            <p className="muted small">
              This introduction did not work out. You will be included in the next cycle.
            </p>
          )}
          {status === "expired" && (
            <p className="muted small">This introduction expired before mutual opt-in.</p>
          )}
        </div>

        {status === "pending" && myResponse === "accepted" && (
          <span className="pill pill-active">Accepted by you</span>
        )}
        {status === "accepted" && <span className="pill pill-active">Connected</span>}
      </div>

      {/* Rationale presentation */}
      <div className="match-rationale">
        <div className="rationale-section">
          <span className="rationale-label">Shared interests</span>
          <p className="rationale-text">{rationale.sharedInterestsText}</p>
        </div>
        <div className="rationale-section">
          <span className="rationale-label">Complementary strength</span>
          <p className="rationale-text">{rationale.complementaryTrait}</p>
        </div>
        <div className="rationale-section">
          <span className="rationale-label">Honest difference</span>
          <p className="rationale-text">{rationale.honestDifference}</p>
        </div>
      </div>

      {/* Pending state actions */}
      {status === "pending" && myResponse !== "accepted" && (
        <div className="match-actions">
          <button
            type="button"
            className="btn"
            disabled={loading}
            onClick={() => handleAction("accept")}
          >
            {loading ? "Saving…" : "Accept introduction"}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={loading}
            onClick={() => handleAction("decline")}
          >
            {loading ? "Saving…" : "Decline"}
          </button>
        </div>
      )}

      {errorMsg && <p className="status">{errorMsg}</p>}

      {/* Mutually accepted state */}
      {status === "accepted" && (
        <>
          <div className="match-contact">
            <strong>Contact details</strong>
            {contact?.telegram_username ? (
              <p>
                Connect on Telegram:{" "}
                <a
                  href={`https://t.me/${contact.telegram_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{contact.telegram_username}
                </a>
              </p>
            ) : (
              <p className="muted small">
                Your match has not set a public Telegram username yet.
              </p>
            )}
            <p className="match-safety">
              Safety note: For your first meeting, choose a public place and let a friend know where
              you are going.
            </p>
          </div>

          {/* Feedback loop */}
          <div className="feedback-box">
            <strong>Private feedback</strong>
            {feedbackSubmitted ? (
              <p className="muted small">
                Thank you for submitting private feedback. Your notes help improve future pairings.
              </p>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="stack">
                <p className="muted small">
                  Would you meet again? This is strictly private and never shown to your match.
                </p>
                <div className="feedback-options">
                  <button
                    type="button"
                    className="chip-btn"
                    data-active={wouldMeetAgain === true}
                    onClick={() => setWouldMeetAgain(true)}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="chip-btn"
                    data-active={wouldMeetAgain === false}
                    onClick={() => setWouldMeetAgain(false)}
                  >
                    No
                  </button>
                </div>
                <div>
                  <label htmlFor={`note-${id}`} className="small">
                    Private note (optional)
                  </label>
                  <textarea
                    id={`note-${id}`}
                    value={feedbackNote}
                    onChange={(e) => setFeedbackNote(e.target.value)}
                    placeholder="Anything the organizers should know (private)"
                  />
                </div>
                {feedbackError && <p className="status">{feedbackError}</p>}
                <div>
                  <button
                    type="submit"
                    className="chip-btn"
                    disabled={feedbackLoading || wouldMeetAgain === null}
                  >
                    {feedbackLoading ? "Saving…" : "Send private feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </li>
  );
}
