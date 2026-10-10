"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  QUESTIONS,
  IMPORTANCE_KEYS,
  IMPORTANCE_OPTIONS,
  type Importance,
  type QuestionDef,
} from "@/lib/questionnaire";
import { useTma } from "../tma/tma-shell";

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

export function QuestionnaireForm({ onComplete, onAction }: {
  onComplete?: () => void;
  onAction?: () => void;
}) {
  const { webApp } = useTma();
  const formRef = useRef<HTMLFormElement>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [importance, setImportance] = useState<Record<string, Importance>>({});
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/questionnaire");
        if (res.ok) {
          const data = await res.json();
          if (data.adult_confirmed === true) {
            setAdultConfirmed(true);
          }
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

  const setSingle = (key: string, value: string) => {
    onAction?.();
    setAnswers((p) => ({ ...p, [key]: value }));
  };
  const setText = (key: string, value: string) =>
    setAnswers((p) => ({ ...p, [key]: value }));
  const toggleMulti = (key: string, value: string, max: number) => {
    onAction?.();
    setAnswers((p) => {
      const cur = Array.isArray(p[key]) ? (p[key] as string[]) : [];
      const next = cur.includes(value)
        ? cur.filter((x) => x !== value)
        : cur.length < max
          ? [...cur, value]
          : cur;
      return { ...p, [key]: next };
    });
  };
  const setImp = (key: string, value: Importance) => {
    onAction?.();
    setImportance((p) => ({ ...p, [key]: value }));
  };

  const required = useMemo(() => QUESTIONS.filter((q) => q.required), []);
  const answeredCount = required.filter((q) => isAnswered(q, answers[q.key])).length;

  const about = QUESTIONS.filter((q) => q.track === "about");
  const want = QUESTIONS.filter((q) => q.track === "want");

  useEffect(() => {
    const mainButton = webApp?.MainButton;
    if (!mainButton) return;
    if (answeredCount < required.length || !adultConfirmed) {
      mainButton.hide();
      return;
    }
    const click = () => formRef.current?.requestSubmit();
    mainButton.setText(busy ? "Saving…" : "Save answers");
    mainButton.onClick(click);
    mainButton.show();
    return () => { mainButton.offClick(click); mainButton.hide(); };
  }, [adultConfirmed, answeredCount, busy, required.length, webApp]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!adultConfirmed) {
      setStatus("Please confirm you are 18 or older to proceed.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: { ...answers, importance },
          adult_confirmed: adultConfirmed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("Saved. Your answers now power your matching.");
        onComplete?.();
      } else {
        setStatus(`Could not save: ${data.error ?? "unknown error"}`);
      }
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
        <form ref={formRef} onSubmit={submit} className="form">
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
          <div className="field q-field" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={adultConfirmed}
                onChange={(e) => {
                  onAction?.();
                  setAdultConfirmed(e.target.checked);
                }}
                required
                style={{ marginTop: "0.25rem" }}
              />
              <span className="small">
                I confirm I am 18 or older and agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              </span>
            </label>
          </div>
          <button type="submit" disabled={busy || answeredCount < required.length || !adultConfirmed} className="btn">
            {busy ? "Saving…" : "Save answers"}
          </button>
        </form>
        {status && <p className="status">{status}</p>}
      </div>
    </main>
  );
}

export default function QuestionnairePage() {
  return <QuestionnaireForm />;
}
