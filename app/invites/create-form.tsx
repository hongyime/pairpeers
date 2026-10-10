"use client";

import { useState } from "react";
import { VOUCH_MIN_LEN, VOUCH_MAX_LEN } from "@/lib/inviteConstants";

/**
 * Invite creation form: the vouch is written atomically with the invite —
 * no vouch text, no invite. Shows the fresh code + shareable link on success.
 */
export default function CreateInviteForm({ invitesLeft, onCreated }: { invitesLeft: number; onCreated?: () => void }) {
  const [vouch, setVouch] = useState("");
  const [relationship, setRelationship] = useState("");
  const [voucherNameApproved, setVoucherNameApproved] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "error" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; link: string } | null>(null);

  const submit = async () => {
    if (status === "busy") return;
    setStatus("busy");
    setError(null);
    try {
      if (!relationship.trim()) {
        throw new Error("Please tell us how you know them.");
      }
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vouch,
          relationship_label: relationship.trim(),
          voucher_name_approved: voucherNameApproved,
        }),
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
            ? "You have used all 3 of your pilot invites."
            : key === "relationship_invalid"
              ? "Please enter a valid relationship (2 to 50 characters)."
              : key === "vouch_invalid"
                ? `Write an honest reference (${VOUCH_MIN_LEN} to ${VOUCH_MAX_LEN} characters).`
                : key === "not_member"
                  ? "Only members can invite."
                  : "Could not create the invite. Try again."
        );
      }
      setCreated({ code: body.code!, link: body.link! });
      setVouch("");
      setRelationship("");
      setVoucherNameApproved(false);
      setStatus("done");
      if (onCreated) onCreated();
      else window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the invite.");
      setStatus("error");
    }
  };

  if (invitesLeft <= 0 && !created) {
    return (
      <p className="muted">
        You have used all 3 of your pilot invites. Non-replenishing for the pilot.
      </p>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="relationship">
          How do you know them?
        </label>
        <input
          id="relationship"
          type="text"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          placeholder="e.g. Close friend, Former colleague, University friend"
          maxLength={50}
          style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--line)" }}
        />
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <label htmlFor="vouch">
          Write their reference. Be honest and specific.
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
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={voucherNameApproved}
            onChange={(e) => setVoucherNameApproved(e.target.checked)}
            style={{ marginTop: "0.2rem" }}
          />
          <span className="small">
            Show my name on their profile. If unchecked, your reference is anonymous as &quot;A friend&quot;.
          </span>
        </label>
      </div>

      <button type="button" className="btn" onClick={submit} disabled={status === "busy"}>
        {status === "busy" ? "Creating…" : `Create invite (${invitesLeft} left)`}
      </button>
      {status === "error" && error && (
        <p className="status" role="alert" style={{ marginTop: "0.5rem" }}>
          {error}
        </p>
      )}
      {status === "done" && created && (
        <p className="status" role="status" style={{ marginTop: "0.5rem" }}>
          Invite created: <code>{created.code}</code>
        </p>
      )}
    </div>
  );
}
