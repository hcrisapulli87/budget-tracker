# Tally

Personal budget tracker PWA for a two-person household. Import bank CSVs, get
auto-categorised transactions (rules that learn from your corrections),
budgets, trends, and one Recurring list — hand-added bills (with Discord
reminders via the household bot) plus automatically detected subscriptions.

**Sharing model** (same as RecipeVault): everything opens on *your* money. The
initials switcher in each screen header gives a read-only look at your
partner's; every write is owner-only. Bills and accounts with no owner are
"Joint" and show for both of you. Tax records are always private.

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

### Upgrading to v7 (standalone per person)

Run `supabase/schema.sql` again **before** deploying this version. It adds
`owner_id` to budgets/rules/bills, copies the household budgets to each
person, keeps existing learned rules as shared defaults, leaves existing bills
and owner-less accounts as Joint, and switches every table to "read all, write
your own". Only rows are added — nothing is deleted. The old
`budget_settlements` table is left in place but no longer used.

## Discord bill reminders

The household bot (`../discord-household-bot/tally_bills.py`) reads
`budget_bills` daily at 8:05 AM Melbourne and posts bills due within 3 days to
the bills channel. It needs `TALLY_SUPABASE_URL` + `TALLY_SUPABASE_SERVICE_KEY`
in the bot's `.env` (service key: Dashboard → Project Settings → API keys →
service_role). Until the key is set, the loop silently skips.
