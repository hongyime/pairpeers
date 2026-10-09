"use client";

import { useState } from "react";
import { VOUCH_MIN_LEN, VOUCH_MAX_LEN } from "@/lib/inviteConstants";

/**
 * Invite creation form: the vouch is written atomically with the invite —
 * no vouch text, no invite. Shows the fresh code + shareable link on success.
 */
export default function CreateInviteForm({ invitesLeft }: { invitesLeft: number }) {
  const [vouch, setVouch] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "error" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; link: string } | null>(null);

  const submit = async () => {
    if (status === "busy") return;
    setStatus("busy");
    setError(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vouch }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
        link?: string;
        error?: string;
      } | null;
      if (!res.ok || !body?.ok) {
        const key = body?.error ?? "db_error";
        throw new Error(
          key === "quota_exhausted"
            ? "You've used all 3 of your pilot invites."
            : key === "vouch_invalid"
              ? `Write an honest reference (${VOUCH_MIN_LEN}–${VOUCH_MAX_LEN} characters).`
              : key === "not_member"
                ? "Only members can invite."
                : "Couldn't create the invite. Try again."
        );
      }
      setCreated({ code: body.code!, link: body.link! });
      setVouch("");
      setStatus("done");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the invite.");
      setStatus("error");
    }
  };

  if (invitesLeft <= 0 && !created) {
    return (
      <p className="muted">
        You&apos;ve used all 3 of your pilot invites. Non-replenishing for the pilot.
      </p>
    );
  }

  return (
    <div>
      <label htmlFor="vouch">
        Write their reference — this <em>is</em> their profile. Be honest and specific.
      </label>
      <textarea
        id="vouch"
        value={vouch}
        onChange={(e) => setVouch(e.target.value)}
        rows={4}
        maxLength={VOUCH_MAX_LEN}
        placeholder="e.g. Mei is the friend who remembers everyone's coffee order. Fiercely loyal, terrible at karaoke, will absolutely beat you at mahjong."
      />
      <p className="muted small">
        {vouch.trim().length}/{VOUCH_MAX_LEN} characters (min {VOUCH_MIN_LEN})
      </p>
      <button type="button" className="btn" onClick={submit} disabled={status === "busy"}>
        {status === "busy" ? "Creating…" : `Create invite (${invitesLeft} left)`}
      </button>
      {status === "error" && error && (
        <p className="status" role="alert">
          {error}
        </p>
      )}
      {status === "done" && created && (
        <p className="status" role="status">
          Invite created: <code>{created.code}</code>
        </p>
      )}
    </div>
  );
}
