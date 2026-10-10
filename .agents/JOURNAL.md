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

