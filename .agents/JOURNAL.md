2026-10-08: Repo brought into `theprawntemplate` conformance (governance docs, .agents/, telemetry stubs, merged AGENTS.md). Rationale: owner's directive — new repos should clone/imitate the template for its baseline files. Production already live; no behavior change from this commit.

- 2026-10-09 16:11 JST: Antigravity review of Telegram OIDC auth done — 8 findings all fixed (cookie cleanup on failure paths, constant-time state compare, RFC 6749 Basic auth encoding, canonical redirect_uri, nonce inside JWT verify, in-handler session check, logout route). Verdict: solidly engineered.
- 2026-10-09 16:11 JST: Tagline finalized: 'Vouched, not swiped. Invite only dating through friends who know you best.'

- 2026-10-09 16:40 JST: Migration 0002 applied via tunneled Postgres (Bryan's transient DB password). Invite system live. IDOR posture reviewed with Bryan: capability-URL design accepted.

- 2026-10-10: Antigravity functional gaps implemented. Migrations 0007 (match_responses, matches.accepted_at) and 0008 (match_feedback, match_nudges) added. State machine (lib/matchOptIn.ts) and rationale generator (lib/matchRationale.ts) unit-tested. Endpoints /api/matches/[id]/accept, /decline, /feedback and admin sweep action shipped. Strict privacy enforced: contact details hidden until status=accepted, scores never exposed.

- 2026-10-10: Batch 2 complete (Antigravity). Migrations 0009 (events), 0010 (match_dates), 0011 (safety_ops), 0012 (account_retention) added. Key architectural choices:
  1. Ban-only safety model (Bryan's directive): eliminated separate invite-suspension state; profile ban (is_banned) atomically invalidates unused invites during redemption. Admin actions are reversible Ban/Unban.
  2. Non-binary matching: open-pool reciprocal eligibility without binary gender coercion in Irving stable roommates with greedy fallback.
  3. Mini App parity: full match opt-in, date check-ins, contact reveal, and feedback in /tma/matches with Telegram haptics.
  4. Account retention: RPC anonymize_profile() tombstones with scrambled negative telegram_id and wipes questionnaire answers without cascade-deleting partner match history.
  5. Founder auth: unified requireFounder() helper; AdminLayout renders static shell with Suspense-wrapped founder gate for Turbopack cacheComponents compatibility.

- 2026-10-10: Launch blockers complete (Antigravity). Migrations 0013 (vouch controls), 0014 (adult consent), 0015 (blocks), 0016 (safety appeals), 0017 (date planning) shipped. Key architectural decisions:
  1. Vouch consent & controls: atomic invite redemption propagates relationship label; voucher name hidden by default until approved; vouchee can hide/remove vouches.
  2. Adult verification & terms: self-declaration 18+ checkbox required on questionnaire; timestamps set server-side; concise terms and privacy routes published with zero em dashes.
  3. Reciprocal diet & religion: diet hard filter treats 'none' as wildcard and enforces reciprocal must-have compatibility; optional Track A religion question and Track B religion preference with must-have dealbreaker semantics.
  4. Block & appeal: global pair exclusion across all cycles; banned users retain appeal submission capability with profile + IP rate limiting and instant founder Telegram alert.
  5. Date planning: up to 3 slots proposed with curated venue picker + custom venue; only non-proposer can select; Telegram alerts on proposal and confirmation; existing check-in loop reused.
  6. Compatible-pair cycle guard: MIN_PAIRS threshold (default 2) skips matching when compatible pairs fall below minimum even if pool heads exceed MATCH_MIN_POOL; audit records skipped_min_pairs.
