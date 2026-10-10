export type DateStatus = "not_planned" | "scheduled" | "happened" | "skipped";

export type MatchDateRecord = {
  match_id: string;
  status: DateStatus;
  scheduled_at: string | null;
  checked_in_at: string | null;
  proposer_id?: string | null;
  slot_1?: string | null;
  slot_2?: string | null;
  slot_3?: string | null;
  venue_text?: string | null;
  selected_slot?: string | null;
  proposed_at?: string | null;
  selected_at?: string | null;
};

export const CURATED_VENUES = [
  "Coffee or cafe",
  "Drinks or bar",
  "Dinner or restaurant",
  "Walk or park",
  "Library or bookstore",
  "Art gallery or museum",
  "Movie or theater",
  "Activity or games",
] as const;

export type DateAction =
  | { type: "schedule"; scheduledAt: string }
  | { type: "check_in"; status: "happened" | "skipped" | "not_planned" }
  | {
      type: "propose";
      proposerId: string;
      slots: string[];
      venueText?: string | null;
    }
  | {
      type: "select";
      selectorId: string;
      selectedSlot: string;
    };

/**
 * Validates a date proposal:
 * - 1 to 3 slots
 * - No past slots
 * - Venue text <= 200 chars
 */
export function validateProposal(
  slots: string[],
  venueText?: string | null,
  now: Date = new Date()
): { ok: true; slots: string[]; venueText: string | null } | { ok: false; error: string } {
  if (!Array.isArray(slots) || slots.length === 0 || slots.length > 3) {
    return { ok: false, error: "Please provide between 1 and 3 proposed times." };
  }

  const cleanedSlots: string[] = [];
  const nowMs = now.getTime();

  for (const s of slots) {
    if (!s || typeof s !== "string") {
      return { ok: false, error: "Invalid slot time format." };
    }
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: "Invalid slot time format." };
    }
    if (d.getTime() <= nowMs) {
      return { ok: false, error: "Proposed times cannot be in the past." };
    }
    cleanedSlots.push(d.toISOString());
  }

  const trimmedVenue = venueText?.trim() || null;
  if (trimmedVenue && trimmedVenue.length > 200) {
    return { ok: false, error: "Venue text must be 200 characters or fewer." };
  }

  return { ok: true, slots: cleanedSlots, venueText: trimmedVenue };
}

/**
 * Validates selecting a slot from a proposal:
 * - A proposal must exist
 * - Proposer cannot select their own proposal (only the partner can select)
 * - Selected slot must match one of the proposed slots
 * - Selected slot cannot be in the past
 */
export function validateSelection(
  current: MatchDateRecord | null | undefined,
  selectorId: string,
  selectedSlot: string,
  now: Date = new Date()
): { ok: true; selectedSlot: string } | { ok: false; error: string; status?: number } {
  if (!current || !current.proposer_id) {
    return { ok: false, error: "No date options have been proposed yet.", status: 400 };
  }

  if (current.proposer_id === selectorId) {
    return {
      ok: false,
      error: "You cannot select your own proposed time. Only your match can select.",
      status: 403,
    };
  }

  const proposedSlots = [current.slot_1, current.slot_2, current.slot_3].filter(
    Boolean
  ) as string[];
  const targetTime = new Date(selectedSlot).getTime();

  if (Number.isNaN(targetTime)) {
    return { ok: false, error: "Invalid time selected.", status: 400 };
  }

  const slotMatched = proposedSlots.some((s) => new Date(s).getTime() === targetTime);
  if (!slotMatched) {
    return { ok: false, error: "Selected time is not among the proposed options.", status: 400 };
  }

  if (targetTime <= now.getTime()) {
    return { ok: false, error: "Selected time cannot be in the past.", status: 400 };
  }

  return { ok: true, selectedSlot: new Date(selectedSlot).toISOString() };
}

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
  proposerId: string | null;
  slot1: string | null;
  slot2: string | null;
  slot3: string | null;
  venueText: string | null;
  selectedSlot: string | null;
  proposedAt: string | null;
  selectedAt: string | null;
  notifyPartnerText: string | null;
} {
  if (action.type === "propose") {
    return {
      nextStatus: "not_planned",
      scheduledAt: null,
      checkedInAt: current?.checked_in_at ?? null,
      proposerId: action.proposerId,
      slot1: action.slots[0] ?? null,
      slot2: action.slots[1] ?? null,
      slot3: action.slots[2] ?? null,
      venueText: action.venueText ?? null,
      selectedSlot: null,
      proposedAt: nowIso,
      selectedAt: null,
      notifyPartnerText:
        "Your introduction proposed date options in PairPeers. View details and choose a time: ",
    };
  }

  if (action.type === "select") {
    return {
      nextStatus: "scheduled",
      scheduledAt: action.selectedSlot,
      checkedInAt: current?.checked_in_at ?? null,
      proposerId: current?.proposer_id ?? null,
      slot1: current?.slot_1 ?? null,
      slot2: current?.slot_2 ?? null,
      slot3: current?.slot_3 ?? null,
      venueText: current?.venue_text ?? null,
      selectedSlot: action.selectedSlot,
      proposedAt: current?.proposed_at ?? null,
      selectedAt: nowIso,
      notifyPartnerText: "Your introduction confirmed a date plan in PairPeers: ",
    };
  }

  if (action.type === "schedule") {
    return {
      nextStatus: "scheduled",
      scheduledAt: action.scheduledAt,
      checkedInAt: current?.checked_in_at ?? null,
      proposerId: current?.proposer_id ?? null,
      slot1: current?.slot_1 ?? null,
      slot2: current?.slot_2 ?? null,
      slot3: current?.slot_3 ?? null,
      venueText: current?.venue_text ?? null,
      selectedSlot: action.scheduledAt,
      proposedAt: current?.proposed_at ?? null,
      selectedAt: nowIso,
      notifyPartnerText:
        "Your introduction proposed a date plan in PairPeers. View details and confirm: ",
    };
  }

  // Check-in action (happened, skipped, or not_planned)
  return {
    nextStatus: action.status,
    scheduledAt: current?.scheduled_at ?? null,
    checkedInAt: action.status === "not_planned" ? null : nowIso,
    proposerId: current?.proposer_id ?? null,
    slot1: current?.slot_1 ?? null,
    slot2: current?.slot_2 ?? null,
    slot3: current?.slot_3 ?? null,
    venueText: current?.venue_text ?? null,
    selectedSlot: current?.selected_slot ?? null,
    proposedAt: current?.proposed_at ?? null,
    selectedAt: current?.selected_at ?? null,
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
