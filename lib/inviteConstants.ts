/** Client-safe invite constants (no node imports — safe for Client Components). */
export const INVITES_PER_USER = 3; // business decision #1: non-replenishing pilot quota
export const INVITE_TTL_DAYS = 3; // business decision #2 (Bryan 2026-10-09)
export const VOUCH_MIN_LEN = 20;
export const VOUCH_MAX_LEN = 500;
