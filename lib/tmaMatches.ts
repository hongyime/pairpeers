import type { MatchRationale } from "./matchRationale.ts";

export type TmaMatchDate = {
  status: "not_planned" | "scheduled" | "happened" | "skipped";
  scheduled_at: string | null;
  checked_in_at?: string | null;
  proposer_id?: string | null;
  slot_1?: string | null;
  slot_2?: string | null;
  slot_3?: string | null;
  venue_text?: string | null;
  selected_slot?: string | null;
  proposed_at?: string | null;
  selected_at?: string | null;
};

export type TmaMatchFeedback = {
  would_meet_again: boolean;
  note: string | null;
};

export type TmaMatchContact = {
  telegram_username: string | null;
};

export type TmaMatch = {
  id: string;
  status: "pending" | "accepted" | "declined" | "expired";
  cycle_started_at: string | null;
  accepted_at: string | null;
  my_response: "accepted" | "declined" | null;
  partner_responded: boolean;
  rationale: MatchRationale;
  contact: TmaMatchContact | null;
  date: TmaMatchDate;
  feedback: TmaMatchFeedback | null;
};

export function canSubmitFeedback(dateStatus: TmaMatchDate["status"]): boolean {
  return dateStatus === "happened" || dateStatus === "skipped";
}

export function applyMatchOptInTransition(
  match: TmaMatch,
  action: "accept" | "decline",
  newStatus?: TmaMatch["status"]
): TmaMatch {
  return {
    ...match,
    my_response: action === "accept" ? "accepted" : "declined",
    status: newStatus ?? (action === "decline" ? "declined" : match.status),
  };
}

export function applyMatchDateTransition(
  match: TmaMatch,
  newStatus: TmaMatchDate["status"],
  scheduledAt?: string | null
): TmaMatch {
  return {
    ...match,
    date: {
      status: newStatus,
      scheduled_at: scheduledAt ?? (newStatus === "scheduled" ? match.date.scheduled_at : null),
      checked_in_at:
        newStatus === "happened" || newStatus === "skipped"
          ? new Date().toISOString()
          : match.date.checked_in_at,
    },
  };
}

export function applyMatchFeedbackTransition(
  match: TmaMatch,
  wouldMeetAgain: boolean,
  note: string | null
): TmaMatch {
  return {
    ...match,
    feedback: {
      would_meet_again: wouldMeetAgain,
      note,
    },
  };
}

export function getMatchStatusLabel(
  status: TmaMatch["status"],
  myResponse: TmaMatch["my_response"]
): string {
  if (status === "pending" && myResponse === "accepted") {
    return "Waiting for match response";
  }
  if (status === "pending") {
    return "Introduction waiting for you";
  }
  if (status === "accepted") {
    return "Mutually accepted";
  }
  if (status === "declined") {
    return "Declined";
  }
  return "Expired";
}
