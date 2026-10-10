export type DateStatus = "not_planned" | "scheduled" | "happened" | "skipped";

export type MatchDateRecord = {
  match_id: string;
  status: DateStatus;
  scheduled_at: string | null;
  checked_in_at: string | null;
};

export type DateAction =
  | { type: "schedule"; scheduledAt: string }
  | { type: "check_in"; status: "happened" | "skipped" | "not_planned" };

/**
 * Returns whether private feedback may be submitted.
 * Feedback is allowed ONLY when the match is mutually accepted AND
 * the date status is 'happened' or 'skipped' (to allow reporting bad actors).
 */
export function isFeedbackEligible(
  matchStatus: string,
  dateStatus: DateStatus | string | null | undefined
): boolean {
  if (matchStatus !== "accepted") return false;
  return dateStatus === "happened" || dateStatus === "skipped";
}

export function computeDateTransition(
  current: MatchDateRecord | null | undefined,
  action: DateAction,
  nowIso: string = new Date().toISOString()
): {
  nextStatus: DateStatus;
  scheduledAt: string | null;
  checkedInAt: string | null;
  notifyPartnerText: string | null;
} {
  if (action.type === "schedule") {
    return {
      nextStatus: "scheduled",
      scheduledAt: action.scheduledAt,
      checkedInAt: current?.checked_in_at ?? null,
      notifyPartnerText:
        "Your introduction proposed a date plan in PairPeers. View details and confirm: ",
    };
  }

  // Check-in action (happened, skipped, or not_planned)
  return {
    nextStatus: action.status,
    scheduledAt: current?.scheduled_at ?? null,
    checkedInAt: action.status === "not_planned" ? null : nowIso,
    notifyPartnerText: null,
  };
}

export function getSweepNudgeText(
  nudgeType: "day_7" | "day_14",
  dateStatus: DateStatus | string | null | undefined,
  baseUrl: string
): string {
  const hasMetOrSkipped = dateStatus === "happened" || dateStatus === "skipped";

  if (hasMetOrSkipped) {
    if (nudgeType === "day_7") {
      return `How did your introduction go? Share private feedback in PairPeers: ${baseUrl}/matches`;
    }
    return `Would you meet your introduction again? Let us know privately in PairPeers: ${baseUrl}/matches`;
  }

  // Date not recorded or still scheduled: prompt for date status first
  if (nudgeType === "day_7") {
    return `Have you two had a chance to meet yet? Update your date status in PairPeers: ${baseUrl}/matches`;
  }
  return `Checking in on your introduction. Let us know if you met up or what happened: ${baseUrl}/matches`;
}
