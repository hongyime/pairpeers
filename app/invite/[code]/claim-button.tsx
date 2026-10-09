"use client";

import { useState } from "react";

const ERROR_COPY: Record<string, string> = {
  invalid_code: "This invite link is invalid.",
  expired: "This invite has expired.",
  already_redeemed: "This invite has already been claimed.",
  self_redeem: "You can't redeem your own invite.",
  unauthenticated: "Please log in first.",
  rate_limited: "Too many attempts. Please wait a minute and try again.",
  db_error: "Something went wrong. Please try again.",
};

/** Claims the invite for the logged-in user, then enters onboarding. */
export default function ClaimInviteButton({ code }: { code: string }) {
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const claim = async () => {
    if (status === "busy") return;
    setStatus("busy");
    setError(null);
    try {
      const res = await fetch(`/api/invite/${code}/redeem`, { method: "POST" });
      if (res.ok) {
        window.location.href = "/questionnaire";
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error || "db_error");
    } catch (err) {
      const key = err instanceof Error ? err.message : "db_error";
      setError(ERROR_COPY[key] ?? ERROR_COPY.db_error!);
      setStatus("error");
    }
  };

  return (
    <div>
      <button type="button" className="btn" onClick={claim} disabled={status === "busy"}>
        {status === "busy" ? "Claiming…" : "Claim your invite"}
      </button>
      {status === "error" && error && (
        <p className="status" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
