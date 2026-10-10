# Project State — PairPeers

## 2026-10-08 - template conformance + production wiring
- Repo restructured to imitate `hongyime/theprawntemplate`: added `.agents/`,
  governance docs (CONTRIBUTING/SECURITY/STANDARDS/LICENSE/NOTICE),
  `.deepsource.toml`, `.sourcery.yml`, `telemetry/` stubs (not wired up —
  PostHog/Sentry stay opt-in; no paid-service exposure).
- AGENTS.md merged: org agent config on top, Next.js auto-generated block
  preserved below (managed by `next dev`, do not hand-edit that section).
- Live: https://pairpeers.hong-yi.me and https://pairpeers.vercel.app
  (Vercel project `pairpeers`, team `theprawnvercel`). GitHub repo
  `hongyime/pairpeers` is public and natively connected for push-to-deploy.
- Backend: Supabase project `jbufhvcuyeywmwbyvnkl`; migration
  `0001_pairpeers.sql` applied (profiles, invites, vouches,
  questionnaire_responses, match_cycles, matches).
- Auth: Telegram bot `@pairpeersbot` configured (token + username env vars set;
  widget verified in the login bundle). BotFather `/setdomain` still needed for
  the login widget to accept logins on the production domain.
- OPEN: Vercel Framework Preset is null — set to Next.js in project settings
  before the next push, or the native build 404s the site.

## Next safe steps
1. Owner: set Framework Preset → Next.js in Vercel project settings.
2. Owner: BotFather `/setdomain` → production domain for `@pairpeersbot`.
3. Tighten RLS per migration TODOs before real users (see README roadmap).

## 2026-10-09 16:11 JST - redirect flow + Antigravity review fixes + final tagline
- OIDC redirect flow (auth code + PKCE) shipped: /api/auth/telegram/redirect,
  /api/auth/telegram/callback; TELEGRAM_CLIENT_SECRET (sensitive) and
  NEXT_PUBLIC_APP_URL stored in Vercel; BotFather redirect URIs registered by Bryan.
- Antigravity (agy) OAuth self-recovered; full auth security review completed:
  8 findings (2 medium, 3 low, 3 info), ALL fixed and deployed in 0d380b6.
- Tagline finalized by Bryan: "Vouched, not swiped. Invite only dating through
  friends who know you best." Applied to hero, metadata, manifest, bot profile.
- Bot profile picture set by Bryan via /setuserpic.
- NEXT: invite system, blocked on Bryan's 10 business decisions (roadmap Track A).

## 2026-10-09 16:40 JST - migration 0002 applied + invite system live
- Bryan supplied the DB password transiently (used once via HTTP CONNECT
  tunnel, never stored). Migration 0002 applied and verified: new columns,
  redemptions table, redeem_invite() function all live.
- Redemption paths tested at DB level: success (uses/vouch/audit/member all
  set), double-redeem rejected, self-redeem rejected, expired rejected.
  Test rows cleaned up.
- Invite system is LIVE: /invites (create), /invite/[code] (preview+claim).
- Bryan's remaining: first login, then founder SQL (is_member/is_founder).
- IDOR question answered: preview is an intentional capability URL, not IDOR.

## 2026-10-09 17:44 JST - RLS lockdown applied, service_role live
- Bryan supplied service_role JWT + sb_secret + anon JWT in chat (used
  transiently, never stored). Added SUPABASE_SERVICE_ROLE_KEY and
  SUPABASE_SECRET_KEY (sensitive) to Vercel; left NEXT_PUBLIC_SUPABASE_ANON_KEY
- Redeployed (89a6751 READY), then applied migration 0003: pilot_open_all
  policies dropped, zero policies remain.
- Verified: anon role sees 0 rows on all tables, INSERT denied; app works via
  service_role (invite preview returns invalid_code, not db_error).
- NOTE: secrets were pasted in chat history — flag rotation hygiene to Bryan.

## 2026-10-10 - functional gaps implementation (Antigravity)
- Branch `agy/functional-gaps` completed and verified.
- Delivered:
  1. Gap 1: Match opt-in UX (accept/decline endpoints, state machine `lib/matchOptIn.ts`, unit tests, notifications via `lib/botNotify.ts`, migration 0007).
  2. Gap 2: Expiry sweep (`POST /api/admin/match/run?action=sweep` 72h window, cycle audit recording, silent expiry without duplicate sweeps).
  3. Gap 3: Post-acceptance loop (`POST /api/matches/[id]/feedback`, migration 0008, 7d/14d Telegram nudges in sweep tracked in `match_nudges`).
  4. Gap 4: Match rationale generator (`lib/matchRationale.ts`, unit tests, contact details strictly hidden until mutual acceptance, scores never displayed).
- Tests & build: all 27 unit tests pass (`npm test`), `npm run build` passes with 0 errors. Zero em dashes in user-facing copy. Service-role server queries used for RLS safety.
## 2026-10-10 - Batch 2 should-have, nice-to-have, and tech debt build (Antigravity)
- Branch `agy/batch2-shouldhave` completed and verified.
- Delivered:
  1. Item 1: Dead code removal (`lib/matching.ts`, `app/questionnaire/form.tsx`, `app/questionnaire/gate.tsx`) and updated `README.md`.
  2. Item 2: Open-pool matching semantics in `lib/matchingCycle.ts` supporting non-binary identities and seeking 'everyone' without binary coercion.
  3. Item 3: Admin auth infrastructure (`lib/adminAuth.ts`, `app/admin/layout.tsx` server founder gate with Suspense, dedicated subpages).
  4. Item 4: Pool-balance monitoring (`lib/poolMetrics.ts`, `app/api/admin/pool/route.ts`, `app/admin/pool/page.tsx`).
  5. Item 5: Append-only event instrumentation (`0009_events.sql`, `lib/events.ts`, `app/api/admin/metrics/route.ts`, `app/admin/metrics/page.tsx`).
  6. Item 6: Date scheduling & check-in loop (`0010_match_dates.sql`, `lib/matchDates.ts`, `app/api/matches/[id]/date/route.ts`, feedback gating on happened/skipped).
  7. Item 7: Safety operations & ban model (`0011_safety_ops.sql`, `app/api/reports/route.ts`, `app/api/admin/safety/route.ts`, `app/admin/safety/page.tsx`). Implemented Bryan's decision: BAN-only model (`is_banned`), ban/unban admin actions, banned profiles invalidate unused invites, dropped separate invite suspension state.
  8. Item 8: Mini App matches parity (`app/tma/matches/page.tsx`, `app/tma/page.tsx` entry, `lib/tmaMatches.ts` + tests) with inline opt-in, date check-ins, contact reveal, feedback, and Telegram haptics.
  9. Item 9: Account anonymization & retention (`0012_account_retention.sql`, `lib/accountData.ts`, `app/api/account/export/route.ts`, `app/api/account/delete/route.ts`, `docs/data-retention.md`, `SECURITY.md` update). Tombstone anonymization preserves partner match histories.
- Verification: All 65 unit tests pass (`npm test`). Full production build (`npm run build`) passes cleanly with 38 generated routes and 0 errors. Zero em dashes in user copy. Service-role-only RLS on all new tables.

## 2026-10-10 - PairPeers launch blockers build (Antigravity)
- Branch `agy/blockers` checked out from main at 22222a5.
- Baseline verified: all 65 unit tests pass, npm run build completes cleanly (38 routes).
- Implementation plan:
  1. Item 1: Vouch consent and controls (migration 0013, lib/vouches.ts, lib/invites.ts, API route /api/vouches/[id], invite form & vouches management UI) — completed in 3a7a38f.
  2. Item 2: Adult verification + terms/consent (migration 0014, adult/terms profile columns, questionnaire form checkbox, /terms and /privacy pages) — completed in 8e1307c.
  3. Item 3: Diet hard filter (reciprocal diet filter in matchingCycle.ts, optional religion questions on about and want tracks) — completed in a351865.
  4. Item 4: Block + appeal (migrations 0015 and 0016, matchBlocks.ts, /api/matches/[id]/block, global pair exclusion in matcher, safety_appeals table, /api/appeals, founder safety queue extension) — completed in 0ece6e0.
  5. Item 5: Date planning (migration 0017, match_dates extension, lib/matchDates.ts, /api/matches/[id]/date route, 3-slot date picker UI, curated venue choices, Telegram notifications) — completed in e968f5b.
  6. Item 6: Compatible-pair cycle guard (lib/matchingCycle.ts pair counting and guard helper, MIN_PAIRS check in /api/admin/match/run, audit recording for skipped_min_pairs) — completed.
- Verification status: All 96 unit tests passing (`npm test`), full build passing cleanly (`npm run build`, 43 routes). Zero em dashes in user copy. Service-role-only RLS on all new tables.



