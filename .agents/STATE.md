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
