"use client";

import { useState } from "react";

export function StatusChecks() {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(action: "info" | "menu_button") {
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
          className="btn secondary"
          disabled={busy}
          onClick={() => call("info")}
        >
          Webhook status
        </button>
        <button
          className="btn secondary"
          disabled={busy}
          onClick={() => call("menu_button")}
        >
          Menu button
        </button>
      </div>
      {result && <pre className="result">{result}</pre>}
    </div>
  );
}
