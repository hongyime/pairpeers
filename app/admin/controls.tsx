"use client";

import { useState } from "react";

export function WebhookControls() {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(action: "set" | "info") {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/bot/webhook?action=${action}`, {
        method: "POST",
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (e) {
      setResult(`request failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <button
          className="btn"
          disabled={busy}
          onClick={() => call("set")}
        >
          Register webhook
        </button>
        <button
          className="btn secondary"
          disabled={busy}
          onClick={() => call("info")}
        >
          Check status
        </button>
      </div>
      {result && <pre className="result">{result}</pre>}
    </div>
  );
}
