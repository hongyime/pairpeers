"use client";

import InvitesClientDashboard from "../../invites/client-dashboard";
import { TmaShell, useTma } from "../tma-shell";

function Content() {
  const { haptic } = useTma();
  return <InvitesClientDashboard onAction={() => haptic()} />;
}

export default function TmaInvitesPage() {
  return <TmaShell title="Invite friends"><Content /></TmaShell>;
}
