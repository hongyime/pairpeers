"use client";

import { useEffect, useMemo, useState } from "react";
import {
  QUESTIONS,
  IMPORTANCE_KEYS,
  IMPORTANCE_OPTIONS,
  type Importance,
  type QuestionDef,
} from "@/lib/questionnaire";

type AnswerValue = string | string[];

function isAnswered(q: QuestionDef, v: AnswerValue | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (q.kind === "text") return typeof v === "string" && v.trim().length > 0;
  if (q.kind === "multi") return Array.isArray(v) && v.length >= (q.min ?? 1);
  return typeof v === "string" && v.length > 0;
}

function TrackSection({
  title,
  blurb,
  questions,
  answers,
  importance,
  setSingle,
  toggleMulti,
  setText,
  setImportance,
}: {
  title: string;
  blurb: string;
  questions: QuestionDef[];
  answers: Record<string, AnswerValue>;
  importance: Record<string, Importance>;
  setSingle: (key: string, value: string) => void;
  toggleMulti: (key: string, value: string, max: number) => void;
  setText: (key: string, value: string) => void;
  setImportance: (key: string, value: Importance) => void;
}) {
  return (
    <section className="q-track">
      <h2>{title}</h2>
      <p className="muted">{blurb}</p>
      {questions.map((q) => (
        <div key={q.key} className="field q-field">
          <span>
            {q.label}
            {q.hint && <span className="q-hint"> · {q.hint}</span>}
          </span>
          {q.kind === "text" ? (
            <textarea
              value={(answers[q.key] as string) ?? ""}
              onChange={(e) => setText(q.key, e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="A line or two is plenty"
            />
          ) : (
            <div className="opt-grid" role="group" aria-label={q.label}>
              {(q.options ?? []).map((o) => {
                const v = answers[q.key];
                const active =
                  q.kind === "single"
                    ? v === o.value
                    : Array.isArray(v) && v.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    className="opt"
                    aria-pressed={active}
                    onClick={() =>
                      q.kind === "single"
                        ? setSingle(q.key, o.value)
                        : toggleMulti(q.key, o.value, q.max ?? 99)
                    }
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}
          {q.track === "want" && q.kind !== "text" && (
            <div className="q-importance">
              <span className="q-importance-label">How much does this matter?</span>
              <div className="opt-grid" role="group" aria-label={`Importance of ${q.label}`}>
                {IMPORTANCE_OPTIONS.map((imp) => {
                  const ikey = q.key === "age_min" || q.key === "age_max" ? "age_range" : q.key;
                  const active = (importance[ikey] ?? "important") === imp.value;
                  return (
                    <button
                      key={imp.value}
                      type="button"
                      className="chip-btn"
                      aria-pressed={active}
                      data-active={active}
                      onClick={() => setImportance(ikey, imp.value)}
                    >
                      {imp.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export default function QuestionnairePage() {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [importance, setImportance] = useState<Record<string, Importance>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/questionnaire");
        if (res.ok) {
          const data = await res.json();
          if (data.answers && typeof data.answers === "object") {
            const { importance: imp, ...rest } = data.answers as Record<string, unknown>;
            const clean: Record<string, AnswerValue> = {};
            for (const [k, v] of Object.entries(rest)) {
              if (typeof v === "string" || Array.isArray(v)) clean[k] = v as AnswerValue;
            }
            setAnswers(clean);
            if (imp && typeof imp === "object") {
              setImportance(imp as Record<string, Importance>);
            }
          }
        }
      } catch {
        // Prefill is best-effort; the form still works empty.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setSingle = (key: string, value: string) =>
    setAnswers((p) => ({ ...p, [key]: value }));
  const setText = (key: string, value: string) =>
    setAnswers((p) => ({ ...p, [key]: value }));
  const toggleMulti = (key: string, value: string, max: number) =>
    setAnswers((p) => {
      const cur = Array.isArray(p[key]) ? (p[key] as string[]) : [];
      const next = cur.includes(value)
        ? cur.filter((x) => x !== value)
        : cur.length < max
          ? [...cur, value]
          : cur;
      return { ...p, [key]: next };
    });
  const setImp = (key: string, value: Importance) =>
    setImportance((p) => ({ ...p, [key]: value }));

  const required = useMemo(() => QUESTIONS.filter((q) => q.required), []);
  const answeredCount = required.filter((q) => isAnswered(q, answers[q.key])).length;

  const about = QUESTIONS.filter((q) => q.track === "about");
  const want = QUESTIONS.filter((q) => q.track === "want");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { ...answers, importance } }),
      });
      const data = await res.json().catch(() => ({}));
      setStatus(
        res.ok ? "Saved. Your answers now power your matching." : `Couldn’t save: ${data.error ?? "unknown error"}`
      );
    } catch {
      setStatus("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="centered">
        <div className="card narrow">
          <p className="muted">Loading…</p>
        </div>
      </main>
    );
  }

  const trackProps = { answers, importance, setSingle, toggleMulti, setText, setImportance: setImp };

  return (
    <main className="centered">
      <div className="card">
        <div className="eyebrow">PairPeers</div>
        <h1>The questionnaire</h1>
        <p className="muted">
          Two short tracks. Everything is tap-to-answer. Hard dealbreakers are
          respected absolutely.
        </p>
        <div className="progress-bar" aria-label={`${answeredCount} of ${required.length} answered`}>
          <div
            className="progress-fill"
            style={{ width: `${Math.round((answeredCount / required.length) * 100)}%` }}
          />
        </div>
        <p className="muted q-progress-label">
          {answeredCount} of {required.length} answered
        </p>
        <form onSubmit={submit} className="form">
          <TrackSection
            title="About you"
            blurb="Who you are. This builds the profile your match sees."
            questions={about}
            {...trackProps}
          />
          <TrackSection
            title="What you want"
            blurb="What you want in a partner. This builds your preference ranking for the matcher."
            questions={want}
            {...trackProps}
          />
          <button type="submit" disabled={busy || answeredCount < required.length} className="btn">
            {busy ? "Saving…" : "Save answers"}
          </button>
        </form>
        {status && <p className="status">{status}</p>}
      </div>
    </main>
  );
}
