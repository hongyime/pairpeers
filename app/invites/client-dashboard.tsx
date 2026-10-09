"use client";

import { useCallback, useEffect, useState } from "react";
import CreateInviteForm from "./create-form";
import InviteRow, { type Invite } from "./invite-row";
import { INVITES_PER_USER } from "@/lib/inviteConstants";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pairpeers.hong-yi.me";

export default function InvitesClientDashboard({ onAction }: { onAction?: () => void }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "not_member" | "error">("loading");
  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/invites");
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) { setState("not_member"); return; }
      if (!response.ok) throw new Error("load_failed");
      setInvites(data.invites ?? []);
      setState("ready");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (state === "loading") return <p className="muted">Loading your invites…</p>;
  if (state === "not_member") return <p className="muted">Only vouched members can invite friends. Ask a friend for an invite link first.</p>;
  if (state === "error") return <p className="status" role="alert">Couldn’t load your invites. Try again.</p>;
  const invitesLeft = Math.max(0, INVITES_PER_USER - invites.length);
  return <>
    <p className="muted">{invitesLeft > 0 ? `You have ${invitesLeft} of ${INVITES_PER_USER} pilot invites left.` : `You've used all ${INVITES_PER_USER} pilot invites.`} Each invite is single-use and expires in 3 days.</p>
    <CreateInviteForm invitesLeft={invitesLeft} onCreated={() => { onAction?.(); void load(); }} />
    {invites.length > 0 && <><h2>Your invites</h2><ul className="invite-list">{invites.map((invite) => <InviteRow key={invite.code} invite={invite} baseUrl={baseUrl} onAction={onAction} />)}</ul></>}
  </>;
}
