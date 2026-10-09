# PairPeers

**Vouched, not swiped.** An invite-only, friends-vouch-friends dating webapp.

This repository follows [`hongyime/theprawntemplate`](https://github.com/hongyime/theprawntemplate).

For agents: read `AGENTS.md` first, then `.agents/STATE.md` before changing files.

Instead of swiping through strangers, you get in because a friend vouches for
you — and your profile is built from what your friends say about you. One
one match per cycle, computed with the Gale–Shapley stable-matching
algorithm. No infinite scroll.

## Stack

- **Next.js 16** (App Router, TypeScript) — deployed on Vercel
- **Supabase** (Postgres + Auth) — profiles, invites, vouches, questionnaires, matches
- **Telegram Login widget** — free, no-review sign-in
- **Gale–Shapley matcher** — `lib/matching.ts`, dependency-free

## Setup

1. **Supabase project** — create one at supabase.com, then run
   `supabase/migrations/0001_pairpeers.sql` (SQL editor or `supabase db push`).

2. **Telegram bot** — talk to [@BotFather](https://t.me/BotFather), create a bot,
   and set its domain to your deployment URL. Note the bot **username**
   (public) and **token** (secret).

3. **Environment** — copy `.env.sample` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_TELEGRAM_BOT_NAME` (bot username, no `@`)
   - `TELEGRAM_BOT_TOKEN` (server-side only)

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
| `/questionnaire` | Short 8-question sample form |
| `/api/auth/telegram` | Verifies the Telegram auth hash (HMAC-SHA256) |
| `/api/questionnaire` | Stub: appends answers to `/tmp` JSONL (TODO: Supabase) |
| `lib/matching.ts` | Gale–Shapley: `compatibility`, `buildPreferences`, `galeShapley`, `checkStability`, `runMatchingCycle` |
| `lib/supabaseClient.ts` / `lib/supabaseServer.ts` | Browser / server Supabase clients |
| `components/TelegramLogin.tsx` | Client component loading telegram-widget.js |
| `supabase/migrations/0001_pairpeers.sql` | profiles, invites, vouches, questionnaire_responses, match_cycles, matches |

## Roadmap

1. **Invite chain enforcement** — redeem invite codes at signup; track
   inviter reputation (private accountability ledger).
2. **Full questionnaire** — expand from the 8-question sample; gate behind auth;
   persist to `questionnaire_responses`.
3. **Friend vouches** — "describe them in 3 words" flow; public hype text +
   private voucher link.
4. **Matching cron** — run `runMatchingCycle` per cycle; write rows to
   `match_cycles` / `matches`; 72h accept window; re-queue unmatched.
5. **Date flow** — plan the date in-app, nudge both sides, collect post-date
   feedback; north-star metric: % of matches that meet in person.
6. **RLS tightening** — the migration ships permissive policies for the pilot;
   lock down per the TODOs before any real users.

## Security notes

- Never commit `.env.local` (gitignored). `TELEGRAM_BOT_TOKEN` is server-only.
- Telegram auth hashes are verified with `timingSafeEqual`; logins older than
  24h are rejected.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
