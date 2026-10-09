/**
 * PairPeers match opt-in state machine.
 *
 * Rules:
 * - Session-bound: caller must be a_id or b_id.
 * - Match must be pending (and not expired: cycle_started_at within 72h).
 * - Idempotent: re-accept is a no-op; re-decline is a no-op.
 * - One accept: records response, notifies the other member.
 * - Both accept: status becomes 'accepted', notifies both with conversation starter + safety note.
 * - Either declines: status becomes 'declined', notifies the other member tactfully.
 * - Copy: concise, warm, no em dashes, no AI-sounding phrasing.
 */

export type MatchResponseStatus = "accepted" | "declined";
export type MatchStatus = "pending" | "accepted" | "declined" | "expired";

export type MatchParticipantResponse = {
  profile_id: string;
  response: MatchResponseStatus;
  responded_at?: string;
};

export type MatchRecord = {
  id: string;
  status: MatchStatus;
  a_id: string;
  b_id: string;
  cycle_started_at: string | Date;
  accepted_at?: string | Date | null;
};

export type NotificationPayload = {
  recipientProfileId: string;
  type: "one_accepted" | "both_accepted" | "declined";
  text: string;
};

export type OptInTransitionResult =
  | {
      ok: true;
      noop: boolean;
      nextMatchStatus: MatchStatus;
      responseToRecord?: {
        profileId: string;
        response: MatchResponseStatus;
      };
      notifications: NotificationPayload[];
    }
  | {
      ok: false;
      error:
        | "not_a_participant"
        | "match_expired"
        | "match_already_declined"
        | "match_already_accepted"
        | "match_not_pending";
      status: number;
    };

export const MATCH_EXPIRY_WINDOW_MS = 72 * 60 * 60 * 1000;

export function buildConversationStarter(sharedInterests?: string[]): string {
  if (sharedInterests && sharedInterests.length > 0) {
    const list = sharedInterests.slice(0, 2).join(" and ");
    return `Start by asking about their thoughts on ${list}.`;
  }
  return "Start by saying hello and asking what they enjoy doing on weekends.";
}

export function buildNotificationText(
  type: "one_accepted" | "both_accepted" | "declined",
  baseUrl: string,
  starter?: string
): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  switch (type) {
    case "one_accepted":
      return `Your introduction is waiting on you. Head to PairPeers to review it: ${cleanBase}/matches`;
    case "both_accepted": {
      const prompt = starter ?? "Start with a friendly hello and introduce yourself.";
      return `You both accepted your introduction! ${prompt} Safety note: For your first meeting, choose a public place and let a friend know where you are going. Connect with your match: ${cleanBase}/matches`;
    }
    case "declined":
      return "Your introduction did not work out. You will be included in the next cycle.";
  }
}

export type MatchOptInAction = "accept" | "decline" | "accepted" | "declined";

export function computeOptInTransition(
  match: MatchRecord,
  callerProfileId: string,
  rawAction: MatchOptInAction,
  existingResponses: MatchParticipantResponse[],
  options: {
    now?: Date;
    baseUrl?: string;
    sharedInterests?: string[];
  } = {}
): OptInTransitionResult {
  const now = options.now ?? new Date();
  const baseUrl = options.baseUrl ?? "https://pairpeers.hong-yi.me";
  const starter = buildConversationStarter(options.sharedInterests);
  const action: MatchResponseStatus =
    rawAction === "accept" || rawAction === "accepted" ? "accepted" : "declined";

  // 1. Participant check
  if (callerProfileId !== match.a_id && callerProfileId !== match.b_id) {
    return { ok: false, error: "not_a_participant", status: 403 };
  }

  const partnerId = callerProfileId === match.a_id ? match.b_id : match.a_id;
  const callerPrev = existingResponses.find((r) => r.profile_id === callerProfileId);
  const partnerPrev = existingResponses.find((r) => r.profile_id === partnerId);

  // 2. Expiry check (72h window based on cycle started_at)
  if (match.status === "pending") {
    const startedMs = new Date(match.cycle_started_at).getTime();
    if (now.getTime() - startedMs > MATCH_EXPIRY_WINDOW_MS) {
      return { ok: false, error: "match_expired", status: 400 };
    }
  }

  // 3. State-specific checks
  if (match.status === "expired") {
    return { ok: false, error: "match_expired", status: 400 };
  }

  if (match.status === "declined") {
    if (action === "declined" && callerPrev?.response === "declined") {
      return { ok: true, noop: true, nextMatchStatus: "declined", notifications: [] };
    }
    return { ok: false, error: "match_already_declined", status: 400 };
  }

  if (match.status === "accepted") {
    if (action === "accepted" && callerPrev?.response === "accepted") {
      return { ok: true, noop: true, nextMatchStatus: "accepted", notifications: [] };
    }
    return { ok: false, error: "match_already_accepted", status: 400 };
  }

  if (match.status !== "pending") {
    return { ok: false, error: "match_not_pending", status: 400 };
  }

  // 4. Pending match handling
  // Idempotent: re-accepting or re-declining with the same response is a no-op
  if (callerPrev?.response === action) {
    return { ok: true, noop: true, nextMatchStatus: "pending", notifications: [] };
  }

  if (action === "accepted") {
    if (partnerPrev?.response === "accepted") {
      // Both accepted!
      return {
        ok: true,
        noop: false,
        nextMatchStatus: "accepted",
        responseToRecord: { profileId: callerProfileId, response: "accepted" },
        notifications: [
          {
            recipientProfileId: callerProfileId,
            type: "both_accepted",
            text: buildNotificationText("both_accepted", baseUrl, starter),
          },
          {
            recipientProfileId: partnerId,
            type: "both_accepted",
            text: buildNotificationText("both_accepted", baseUrl, starter),
          },
        ],
      };
    }

    // One accepted! Notify partner.
    return {
      ok: true,
      noop: false,
      nextMatchStatus: "pending",
      responseToRecord: { profileId: callerProfileId, response: "accepted" },
      notifications: [
        {
          recipientProfileId: partnerId,
          type: "one_accepted",
          text: buildNotificationText("one_accepted", baseUrl),
        },
      ],
    };
  }

  // action === "declined"
  // Either declines -> matches.status = 'declined', notify the other member tactfully.
  return {
    ok: true,
    noop: false,
    nextMatchStatus: "declined",
    responseToRecord: { profileId: callerProfileId, response: "declined" },
    notifications: [
      {
        recipientProfileId: partnerId,
        type: "declined",
        text: buildNotificationText("declined", baseUrl),
      },
    ],
  };
}
