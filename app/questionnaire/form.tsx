"use client";

import { useState } from "react";

type Question =
  | { key: string; label: string; type: "text" | "number" }
  | { key: string; label: string; type: "select"; options: readonly string[] };

const QUESTIONS: Question[] = [
  { key: "interests", label: "What are you into these days? (comma-separated)", type: "text" },
  { key: "night_owl", label: "Team sunrise or team 2am?", type: "select", options: ["sunrise", "2am"] },
  { key: "smokes", label: "Do you smoke?", type: "select", options: ["no", "socially", "yes"] },
  { key: "kids", label: "Do you see yourself having kids?", type: "select", options: ["yes", "open", "unsure", "probably_not", "no"] },
  { key: "dealbreakers", label: "Any hard dealbreakers? (comma-separated: smoking, religion, diet)", type: "text" },
  { key: "min_age", label: "Youngest age you'd date", type: "number" },
  { key: "max_age", label: "Oldest age you'd date", type: "number" },
  { key: "note", label: "A short note for your future match", type: "text" },
] as const;

/**
 * Short 8-question sample form. POSTs JSON to /api/questionnaire.
 * TODO: gate behind auth, expand to the full questionnaire, persist to Supabase.
 */
export default function QuestionnaireForm() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Option-chip questions aren't native form controls, so validate manually.
    const missing = QUESTIONS.filter(
      (q) => q.key !== "note" && !answers[q.key]
    );
    if (missing.length > 0) {
      setStatus(`Please answer: ${missing.map((q) => q.label).join("; ")}`);
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(answers),
      });
      const data = await res.json();
      setStatus(res.ok ? "Saved ✓" : `Error: ${data.error}`);
    } catch (err) {
      setStatus(`Network error: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="centered">
      <div className="card">
        <div className="questionnaire-header">
          <div className="eyebrow">PairPeers</div>
          <h1>The questionnaire</h1>
          <p className="muted">
            A short sample of the full thing. Your answers feed the matching engine —
            hard dealbreakers are respected absolutely.
          </p>
          <div className="progress-wrap" aria-label="Question 3 of 8">
            <span>Question 3 of 8</span>
            <div className="progress-bar" aria-hidden="true" />
          </div>
        </div>
        <form onSubmit={submit} className="form">
          {QUESTIONS.map((q) => (
            <div key={q.key} className="question-card">
              <div className="field">
                <span id={`${q.key}-label`}>{q.label}</span>
                {q.type === "select" ? (
                  <div
                    className="opt-grid"
                    role="radiogroup"
                    aria-labelledby={`${q.key}-label`}
                  >
                    {q.options.map((o) => (
                      <button
                        key={o}
                        type="button"
                        className="opt"
                        aria-pressed={answers[q.key] === o}
                        onClick={() => set(q.key, o)}
                      >
                        {o.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type={q.type}
                    aria-label={q.label}
                    value={answers[q.key] ?? ""}
                    onChange={(e) => set(q.key, e.target.value)}
                    required={q.key !== "note"}
                  />
                )}
              </div>
            </div>
          ))}
          <button type="submit" disabled={busy} className="btn">
            {busy ? "Saving…" : "Submit answers"}
          </button>
        </form>
        {status && <p className="status">{status}</p>}
      </div>
    </main>
  );
}
