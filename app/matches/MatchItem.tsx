"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchRationale } from "@/lib/matchRationale";
import { CURATED_VENUES } from "@/lib/matchDates";

export type MatchItemProps = {
  id: string;
  callerProfileId?: string;
  initialStatus: "pending" | "accepted" | "declined" | "expired";
  initialMyResponse: "accepted" | "declined" | null;
  rationale: MatchRationale;
  contact: { telegram_username: string | null } | null;
  initialFeedback: { would_meet_again: boolean; note: string | null } | null;
  initialDate?: {
    status: "not_planned" | "scheduled" | "happened" | "skipped";
    scheduled_at: string | null;
    checked_in_at: string | null;
    proposer_id?: string | null;
    slot_1?: string | null;
    slot_2?: string | null;
    slot_3?: string | null;
    venue_text?: string | null;
    selected_slot?: string | null;
    proposed_at?: string | null;
    selected_at?: string | null;
  } | null;
};

export function MatchItem({
  id,
  callerProfileId,
  initialStatus,
  initialMyResponse,
  rationale,
  contact,
  initialFeedback,
  initialDate,
}: MatchItemProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [myResponse, setMyResponse] = useState(initialMyResponse);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Date state
  const [dateStatus, setDateStatus] = useState<
    "not_planned" | "scheduled" | "happened" | "skipped"
  >(initialDate?.status ?? "not_planned");
  const [scheduledAt, setScheduledAt] = useState<string | null>(
    initialDate?.scheduled_at ?? null
  );
  const [proposerId, setProposerId] = useState<string | null>(
    initialDate?.proposer_id ?? null
  );
  const [slots, setSlots] = useState<string[]>(
    [initialDate?.slot_1, initialDate?.slot_2, initialDate?.slot_3].filter(
      (s): s is string => typeof s === "string" && Boolean(s)
    )
  );
  const [venueText, setVenueText] = useState<string | null>(
    initialDate?.venue_text ?? null
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(
    initialDate?.selected_slot ?? null
  );

  const [dateLoading, setDateLoading] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  // Proposal form state
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [slot1, setSlot1] = useState("");
  const [slot2, setSlot2] = useState("");
  const [slot3, setSlot3] = useState("");
  const [curatedVenue, setCuratedVenue] = useState("");
  const [customVenue, setCustomVenue] = useState("");

  // Slot selection state for partner
  const [selectedSlotChoice, setSelectedSlotChoice] = useState<string>("");

  // Feedback state
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(Boolean(initialFeedback));
  const [wouldMeetAgain, setWouldMeetAgain] = useState<boolean | null>(
    initialFeedback ? initialFeedback.would_meet_again : null
  );
  const [feedbackNote, setFeedbackNote] = useState(initialFeedback?.note ?? "");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Block state
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  async function handleBlock() {
    if (
      !window.confirm(
        "Block this introduction? You and this person will never be paired in any future cycle."
      )
    ) {
      return;
    }
    setBlockLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/matches/${id}/block`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Could not block introduction.");
        return;
      }
      setIsBlocked(true);
      router.refresh();
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setBlockLoading(false);
    }
  }

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

  async function handleProposalSubmit(e: React.FormEvent) {
    e.preventDefault();
    const proposedSlots = [slot1, slot2, slot3].filter(Boolean);
    if (proposedSlots.length === 0) {
      setDateError("Please provide at least one proposed time.");
      return;
    }
    const finalVenue = customVenue.trim() || curatedVenue || undefined;

    setDateLoading(true);
    setDateError(null);
    try {
      const res = await fetch(`/api/matches/${id}/date`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "propose",
          slots: proposedSlots,
          venue: finalVenue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDateError(data.error ?? "Could not submit date options.");
        return;
      }
      setDateStatus(data.status);
      setProposerId(data.proposer_id);
      setSlots(
        [data.slot_1, data.slot_2, data.slot_3].filter(
          (s): s is string => typeof s === "string" && Boolean(s)
        )
      );
      setVenueText(data.venue_text ?? null);
      setSelectedSlot(null);
      setScheduledAt(null);
      setShowProposalForm(false);
      router.refresh();
    } catch {
      setDateError("Network error. Please try again.");
    } finally {
      setDateLoading(false);
    }
  }

  async function handleSelectSlot(slotVal: string) {
    if (!slotVal) return;
    setDateLoading(true);
    setDateError(null);
    try {
      const res = await fetch(`/api/matches/${id}/date`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "select",
          slot: slotVal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDateError(data.error ?? "Could not confirm chosen date.");
        return;
      }
      setDateStatus(data.status);
      setScheduledAt(data.scheduled_at);
      setSelectedSlot(data.selected_slot);
      router.refresh();
    } catch {
      setDateError("Network error. Please try again.");
    } finally {
      setDateLoading(false);
    }
  }

  async function handleDateCheckIn(
    newStatus: "happened" | "skipped" | "not_planned"
  ) {
    setDateLoading(true);
    setDateError(null);
    try {
      const res = await fetch(`/api/matches/${id}/date`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "check_in", status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDateError(data.error ?? "Could not update date status.");
        return;
      }
      setDateStatus(data.status);
      setScheduledAt(data.scheduled_at ?? null);
      setShowProposalForm(false);
      router.refresh();
    } catch {
      setDateError("Network error. Please try again.");
    } finally {
      setDateLoading(false);
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

  const canGiveFeedback = dateStatus === "happened" || dateStatus === "skipped";
  const isCallerProposer = Boolean(callerProfileId && proposerId && callerProfileId === proposerId);
  const canCallerSelect = Boolean(
    callerProfileId && proposerId && callerProfileId !== proposerId && slots.length > 0
  );

  if (isBlocked) return null;

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

          {/* Date coordination & check-in */}
          <div className="feedback-box">
            <strong>Date planning and check-in</strong>

            <div style={{ marginTop: "0.5rem" }}>
              {dateStatus === "scheduled" && scheduledAt && (
                <div>
                  <p className="small" style={{ color: "var(--primary)", fontWeight: 600 }}>
                    Date confirmed: {new Date(scheduledAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" })}
                  </p>
                  {venueText && (
                    <p className="small muted" style={{ marginTop: "0.25rem" }}>
                      Venue: <strong>{venueText}</strong>
                    </p>
                  )}
                </div>
              )}

              {dateStatus === "happened" && (
                <p className="small" style={{ color: "#166534", fontWeight: 600 }}>
                  Date completed. You can leave private feedback below.
                </p>
              )}

              {dateStatus === "skipped" && (
                <p className="small" style={{ color: "#991b1b", fontWeight: 600 }}>
                  Date was skipped or cancelled. You can leave private feedback below.
                </p>
              )}

              {dateStatus === "not_planned" && slots.length > 0 && (
                <div style={{ marginTop: "0.25rem" }}>
                  {isCallerProposer ? (
                    <div>
                      <p className="small" style={{ fontWeight: 600 }}>
                        You proposed times. Waiting for your match to confirm one:
                      </p>
                      <ul style={{ margin: "0.25rem 0", paddingLeft: "1.25rem", fontSize: "0.875rem" }}>
                        {slots.map((s, idx) => (
                          <li key={idx}>
                            {new Date(s).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                          </li>
                        ))}
                      </ul>
                      {venueText && (
                        <p className="small muted">
                          Venue: <strong>{venueText}</strong>
                        </p>
                      )}
                    </div>
                  ) : canCallerSelect ? (
                    <div>
                      <p className="small" style={{ fontWeight: 600 }}>
                        Your match proposed the following options. Choose a time:
                      </p>
                      {venueText && (
                        <p className="small muted" style={{ marginBottom: "0.5rem" }}>
                          Venue: <strong>{venueText}</strong>
                        </p>
                      )}
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
                        {slots.map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="chip-btn"
                            data-active={selectedSlotChoice === s}
                            onClick={() => setSelectedSlotChoice(s)}
                          >
                            {new Date(s).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn"
                        disabled={dateLoading || !selectedSlotChoice}
                        onClick={() => handleSelectSlot(selectedSlotChoice)}
                        style={{ marginTop: "0.25rem" }}
                      >
                        {dateLoading ? "Saving…" : "Confirm chosen time"}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {dateStatus === "not_planned" && slots.length === 0 && (
                <p className="muted small">
                  No date planned yet. Propose times and a place, or record what happened.
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
              {dateStatus !== "happened" && (
                <button
                  type="button"
                  className="chip-btn"
                  disabled={dateLoading}
                  onClick={() => handleDateCheckIn("happened")}
                >
                  We met up
                </button>
              )}
              {dateStatus !== "skipped" && (
                <button
                  type="button"
                  className="chip-btn"
                  disabled={dateLoading}
                  onClick={() => handleDateCheckIn("skipped")}
                >
                  Did not happen
                </button>
              )}
              {dateStatus !== "happened" && (
                <button
                  type="button"
                  className="chip-btn"
                  disabled={dateLoading}
                  onClick={() => setShowProposalForm((v) => !v)}
                >
                  {showProposalForm
                    ? "Cancel proposal"
                    : slots.length > 0
                    ? "Propose different times"
                    : "Plan a date"}
                </button>
              )}
              {(dateStatus === "happened" || dateStatus === "skipped") && (
                <button
                  type="button"
                  className="chip-btn"
                  disabled={dateLoading}
                  onClick={() => handleDateCheckIn("not_planned")}
                >
                  Reset status
                </button>
              )}
            </div>

            {/* Proposal Form */}
            {showProposalForm && (
              <form onSubmit={handleProposalSubmit} style={{ marginTop: "1rem", borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
                <p className="small" style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                  Propose up to 3 date times:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>
                    <label className="small muted" htmlFor={`slot1-${id}`}>Time option 1 (required)</label>
                    <input
                      id={`slot1-${id}`}
                      type="datetime-local"
                      required
                      value={slot1}
                      onChange={(e) => setSlot1(e.target.value)}
                      style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.2rem" }}
                    />
                  </div>
                  <div>
                    <label className="small muted" htmlFor={`slot2-${id}`}>Time option 2 (optional)</label>
                    <input
                      id={`slot2-${id}`}
                      type="datetime-local"
                      value={slot2}
                      onChange={(e) => setSlot2(e.target.value)}
                      style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.2rem" }}
                    />
                  </div>
                  <div>
                    <label className="small muted" htmlFor={`slot3-${id}`}>Time option 3 (optional)</label>
                    <input
                      id={`slot3-${id}`}
                      type="datetime-local"
                      value={slot3}
                      onChange={(e) => setSlot3(e.target.value)}
                      style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.2rem" }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: "0.75rem" }}>
                  <p className="small" style={{ fontWeight: 600, marginBottom: "0.4rem" }}>
                    Select a venue idea:
                  </p>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                    {CURATED_VENUES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="chip-btn"
                        data-active={curatedVenue === v}
                        onClick={() => {
                          setCuratedVenue(curatedVenue === v ? "" : v);
                          if (curatedVenue !== v) setCustomVenue("");
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <label className="small muted" htmlFor={`venue-${id}`}>Or specify a venue (optional):</label>
                  <input
                    id={`venue-${id}`}
                    type="text"
                    maxLength={200}
                    placeholder="e.g. Arabica Coffee at 313"
                    value={customVenue}
                    onChange={(e) => setCustomVenue(e.target.value)}
                    style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.2rem" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <button
                    type="submit"
                    className="btn"
                    disabled={dateLoading || !slot1}
                  >
                    {dateLoading ? "Sending…" : "Send date proposal"}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setShowProposalForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {dateError && <p className="status" style={{ marginTop: "0.5rem" }}>{dateError}</p>}
          </div>

          {/* Feedback loop: GATED on date happened or skipped */}
          <div className="feedback-box">
            <strong>Private feedback</strong>
            {!canGiveFeedback ? (
              <p className="muted small" style={{ marginTop: "0.25rem" }}>
                Private feedback unlocks after your date has happened or was skipped.
              </p>
            ) : feedbackSubmitted ? (
              <p className="muted small" style={{ marginTop: "0.25rem" }}>
                Thank you for submitting private feedback. Your notes help improve future pairings.
              </p>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="stack" style={{ marginTop: "0.5rem" }}>
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
      <div style={{ marginTop: "1rem", borderTop: "1px solid var(--line)", paddingTop: "0.5rem", display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="chip-btn"
          style={{ color: "#991b1b", fontSize: "0.85rem" }}
          disabled={blockLoading}
          onClick={handleBlock}
        >
          {blockLoading ? "Blocking…" : "Block introduction"}
        </button>
      </div>
    </li>
  );
}
