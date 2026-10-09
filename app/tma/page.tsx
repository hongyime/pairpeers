"use client";

import Link from "next/link";
import { TmaShell, useTma } from "./tma-shell";

function HomeContent() {
  const { haptic } = useTma();
  return <>
    <p>Vouched, not swiped. Your Telegram session is ready.</p>
    <div className="actions" style={{ flexDirection: "column", gap: 10 }}>
      <Link className="btn" href="/tma/questionnaire" onClick={() => haptic()}>Complete questionnaire</Link>
      <Link className="btn secondary" href="/tma/invites" onClick={() => haptic()}>Manage invites</Link>
    </div>
  </>;
}

export default function TelegramMiniAppPage() {
  return <TmaShell title="Welcome to PairPeers" home><HomeContent /></TmaShell>;
}
