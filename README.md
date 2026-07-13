# Tally

Two-person budget tracker PWA for the household. Import bank CSVs, get
auto-categorised transactions (rules that learn from your corrections),
spending analytics, automatic subscription detection, and bills with Discord
reminders via the household bot.

**Spec:** `../docs/superpowers/specs/2026-07-13-budget-tracker-design.md`
**Plan:** `../docs/superpowers/plans/2026-07-13-tally-budget-tracker.md`

## Stack

React + Vite + TypeScript PWA (Tandem pattern) · Supabase (shared **Tandem**
project — `budget_*` tables) · Vercel · Vitest.

## Develop

```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (domain logic)
npm run typecheck
npm run build
```

Env: copy `.env.example` to `.env` and use the same two values as `tandem/.env`
(same Supabase project; the publishable key is safe in the browser — security
is Row-Level Security).

## Deploy order (important)

1. Run `supabase/schema.sql` in the **Tandem** Supabase project's SQL Editor
   (idempotent; the "destructive operation" warning is only the
   drop-and-recreate *policies* — no table/row drops).
2. Verify the `budget_*` tables exist in the Table Editor.
3. Then connect this repo to Vercel with `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` env vars.
4. iPhone: open the Vercel URL in Safari → Share → Add to Home Screen.

## Discord bill reminders

The household bot (`../discord-household-bot/tally_bills.py`) reads
`budget_bills` daily at 8:05 AM Melbourne and posts bills due within 3 days to
the bills channel. It needs `TALLY_SUPABASE_URL` + `TALLY_SUPABASE_SERVICE_KEY`
in the bot's `.env` (service key: Dashboard → Project Settings → API keys →
service_role). Until the key is set, the loop silently skips.
