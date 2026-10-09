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

/** One invite row: code, status, copy-link, and a QR for in-person sharing. */
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
    <li className={`invite-row invite-${status}`}>
      <code>{invite.code}</code>
      <span className="muted small">{status}</span>
      {!used && !expired && (
        <>
          <button type="button" className="link-btn" onClick={copy}>
            {copied ? "copied ✓" : "copy link"}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => setShowQr((v) => !v)}
            aria-expanded={showQr}
          >
            {showQr ? "hide QR" : "QR"}
          </button>
        </>
      )}
      {showQr && !used && !expired && (
        <div className="qr-wrap">
          <QRCode value={link} size={160} />
          <p className="muted small">Scan to claim this invite</p>
        </div>
      )}
    </li>
  );
}
