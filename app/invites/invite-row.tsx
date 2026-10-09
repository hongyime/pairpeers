"use client";

import { useState } from "react";
import QRCode from "react-qr-code";

type Invite = {
  code: string;
  vouch_text: string | null;
  expires_at: string;
  uses: number;
  max_uses: number;
  created_at: string;
};

/** One invite card: code + status, actions, and a scannable QR. */
export default function InviteRow({
  invite,
  baseUrl,
}: {
  invite: Invite;
  baseUrl: string;
}) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const expired = new Date(invite.expires_at) <= new Date();
  const used = invite.uses >= invite.max_uses;
  const status = used ? "claimed" : expired ? "expired" : "active";
  const link = `${baseUrl}/invite/${invite.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <li className={`invite-card invite-${status}`}>
      <div className="invite-top">
        <code>{invite.code}</code>
        <span className={`pill pill-${status}`}>{status}</span>
      </div>
      {!used && !expired && (
        <div className="invite-actions">
          <button type="button" className="chip-btn" onClick={copy}>
            {copied ? "Copied ✓" : "Copy link"}
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => setShowQr((v) => !v)}
            aria-expanded={showQr}
          >
            {showQr ? "Hide QR" : "Show QR"}
          </button>
        </div>
      )}
      {showQr && !used && !expired && (
        <div className="qr-card">
          <QRCode value={link} size={168} fgColor="#832848" />
          <p>Scan to claim this invite</p>
        </div>
      )}
    </li>
  );
}
