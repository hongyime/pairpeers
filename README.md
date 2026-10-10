# PairPeers

**Vouched, not swiped.** An invite-only, friends-vouch-friends dating webapp.

This repository follows [`hongyime/theprawntemplate`](https://github.com/hongyime/theprawntemplate).

For agents: read `AGENTS.md` first, then `.agents/STATE.md` before changing files.

Instead of swiping through strangers, you get in because a friend vouches for
Instead of swiping through strangers, you get in because a friend vouches for
you, and your profile is built from what your friends say about you. One
match per cycle, computed with Irving's stable-roommates algorithm (with greedy
fallback). No infinite scroll.

## Stack

- **Next.js 16** (App Router, TypeScript) - deployed on Vercel
- **Supabase** (Postgres + Auth + Service Role) - profiles, invites, vouches, questionnaire responses, matches
- **Telegram Login widget & Mini App** - sign-in and Telegram Mini App integration
- **Matching Engine** - `lib/matchingCycle.ts`, dependency-free Irving / greedy algorithm

## Matching Semantics and Open-Pool Support

The matching engine in `lib/matchingCycle.ts` matches participants reciprocally:
- **Identities**: Participants can identify as `man`, `woman`, `nonbinary`, or `prefer_not`.
- **Seeking Preferences**: Participants can choose to meet `men`, `women`, or `everyone`.
- **Open-pool Reciprocity**: Non-binary and prefer-not-to-say participants match with anyone who selects `seeking: "everyone"`.
- **No Binary Coercion**: A seeker looking specifically for `men` or `women` will never be matched with a non-binary or prefer-not-to-say participant, and vice versa. Matching requires mutual satisfaction of both participants' seeking criteria.

## Setup

1. **Supabase project** - create one at supabase.com, then run migrations in order:
   - `0001_pairpeers.sql` (core schema: profiles, invites, vouches, match_cycles, matches)
   - `0002_invites.sql` (invite redemption function and limits)
   - `0003_rls_lockdown.sql` (service role lockdown)
   - `0004_phone.sql` (phone number column)
   - `0005_username.sql` (telegram username sync)
   - `0006_match_audit.sql` (cycle audit history)
   - `0007_match_optin.sql` (match response state machine)
   - `0008_match_feedback.sql` (post-match feedback and nudges)

2. **Telegram bot** - talk to [@BotFather](https://t.me/BotFather), create a bot,
   and set its domain to your deployment URL. Note the bot **username**
   (public) and **token** (secret).

3. **Environment** - copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_TELEGRAM_BOT_NAME` (bot username, no `@`)
   - `TELEGRAM_BOT_TOKEN` (server-side only)
   - `CRON_SECRET` (admin cron runner authorization)

4. **Run**
   ```bash
   npm install
   npm run dev     # http://localhost:3000
   npm run build   # production build check
   ```

## What's here

| Path | What |
|---|---|
| `/` | Landing page |
| `/login` | Telegram login widget |
| `/questionnaire` | Multi-track questionnaire (Track A: about, Track B: preferences) |
| `/matches` | Matches view with 72h accept/decline opt-in and feedback |
| `/tma` | Telegram Mini App experience |
| `/admin` | Founder dashboard and cycle controls |
| `/api/auth/telegram` | Verifies Telegram auth hash (HMAC-SHA256) and sets session |
| `/api/questionnaire` | Validates answers and saves to Supabase `questionnaire_responses` |
| `/api/matches` | Returns user matches, state machine actions, contact reveals |
| `lib/matchingCycle.ts` | Irving stable roommates with greedy fallback, coarse age brackets, open-pool semantics |
| `lib/supabaseClient.ts` / `lib/supabaseServer.ts` | Browser and server Supabase clients (service role supported) |
| `components/TelegramLogin.tsx` | Client component loading telegram-widget.js |

## Security notes

- Never commit `.env.local` (gitignored). `TELEGRAM_BOT_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` are server-only.
- Telegram auth hashes are verified with `timingSafeEqual`; logins older than 24h are rejected.
- All database access is locked down with Row Level Security (RLS) and mediated by the server.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
