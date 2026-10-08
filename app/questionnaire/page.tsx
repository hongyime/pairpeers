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
export default function QuestionnairePage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(answers),
      });
      const data = await res.json();
      setStatus(res.ok ? `Saved ✓ (${data.stored})` : `Error: ${data.error}`);
    } catch (err) {
      setStatus(`Network error: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="centered">
      <div className="card">
        <div className="eyebrow">PairPeers</div>
        <h1>The questionnaire</h1>
        <p className="muted">
          A short sample of the full thing. Your answers feed the matching engine —
          hard dealbreakers are respected absolutely.
        </p>
        <form onSubmit={submit} className="form">
          {QUESTIONS.map((q) => (
            <label key={q.key} className="field">
              <span>{q.label}</span>
              {q.type === "select" ? (
                <select value={answers[q.key] ?? ""} onChange={(e) => set(q.key, e.target.value)} required>
                  <option value="" disabled>Choose…</option>
                  {q.options.map((o) => (
                    <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={q.type}
                  value={answers[q.key] ?? ""}
                  onChange={(e) => set(q.key, e.target.value)}
                  required={q.key !== "note"}
                />
              )}
            </label>
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
