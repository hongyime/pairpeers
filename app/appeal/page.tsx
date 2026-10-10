"use client";

import { useState } from "react";
import Link from "next/link";

export default function AppealPage() {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "submitted" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg("Please provide a reason for your appeal.");
      return;
    }

    setStatus("busy");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/appeals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          details: details.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429) {
          setErrorMsg("You have submitted several requests recently. Please wait a minute and try again.");
        } else if (res.status === 401) {
          setErrorMsg("Please sign in to submit an appeal.");
        } else {
          setErrorMsg(data.error ?? "Could not submit your appeal. Please try again.");
        }
        setStatus("error");
        return;
      }
      setStatus("submitted");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <main className="centered">
      <div className="card narrow">
        <div className="eyebrow">Safety & Support</div>
        <h1>Account appeal</h1>
        <p className="muted">
          If your account was banned or restricted, you can appeal the decision. Our team reviews every appeal personally.
        </p>

        {status === "submitted" ? (
          <div style={{ marginTop: "1.5rem" }}>
            <p className="status" style={{ color: "#166534", fontWeight: 600 }}>
              Your appeal has been received. Our team will review it and notify you on Telegram.
            </p>
            <p className="muted small" style={{ marginTop: "1rem" }}>
              <Link href="/">Back to home</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="stack" style={{ marginTop: "1.5rem" }}>
            <div>
              <label htmlFor="reason">
                Reason for appeal
              </label>
              <input
                id="reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Account mistakenly flagged"
                maxLength={200}
                required
                style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--line)" }}
              />
            </div>

            <div>
              <label htmlFor="details">
                Additional context (optional)
              </label>
              <textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Explain what happened or why you believe the restriction should be lifted."
              />
            </div>

            {errorMsg && <p className="status" role="alert">{errorMsg}</p>}

            <button type="submit" className="btn" disabled={status === "busy"}>
              {status === "busy" ? "Submitting…" : "Submit appeal"}
            </button>

            <p className="muted small" style={{ marginTop: "1rem" }}>
              <Link href="/">Back to home</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
