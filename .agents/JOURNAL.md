2026-10-08: Repo brought into `theprawntemplate` conformance (governance docs, .agents/, telemetry stubs, merged AGENTS.md). Rationale: owner's directive — new repos should clone/imitate the template for its baseline files. Production already live; no behavior change from this commit.

- 2026-10-09 16:11 JST: Antigravity review of Telegram OIDC auth done — 8 findings all fixed (cookie cleanup on failure paths, constant-time state compare, RFC 6749 Basic auth encoding, canonical redirect_uri, nonce inside JWT verify, in-handler session check, logout route). Verdict: solidly engineered.
- 2026-10-09 16:11 JST: Tagline finalized: 'Vouched, not swiped. Invite only dating through friends who know you best.'

- 2026-10-09 16:40 JST: Migration 0002 applied via tunneled Postgres (Bryan's transient DB password). Invite system live. IDOR posture reviewed with Bryan: capability-URL design accepted.

- 2026-10-10: Antigravity functional gaps implemented. Migrations 0007 (match_responses, matches.accepted_at) and 0008 (match_feedback, match_nudges) added. State machine (lib/matchOptIn.ts) and rationale generator (lib/matchRationale.ts) unit-tested. Endpoints /api/matches/[id]/accept, /decline, /feedback and admin sweep action shipped. Strict privacy enforced: contact details hidden until status=accepted, scores never exposed.

