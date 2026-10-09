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
