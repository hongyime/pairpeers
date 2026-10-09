2026-10-08: Repo brought into `theprawntemplate` conformance (governance docs, .agents/, telemetry stubs, merged AGENTS.md). Rationale: owner's directive — new repos should clone/imitate the template for its baseline files. Production already live; no behavior change from this commit.

- 2026-10-09 16:11 JST: Antigravity review of Telegram OIDC auth done — 8 findings all fixed (cookie cleanup on failure paths, constant-time state compare, RFC 6749 Basic auth encoding, canonical redirect_uri, nonce inside JWT verify, in-handler session check, logout route). Verdict: solidly engineered.
- 2026-10-09 16:11 JST: Tagline finalized: 'Vouched, not swiped. Invite only dating through friends who know you best.'

- 2026-10-09 16:40 JST: Migration 0002 applied via tunneled Postgres (Bryan's transient DB password). Invite system live. IDOR posture reviewed with Bryan: capability-URL design accepted.
