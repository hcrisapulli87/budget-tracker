# Tally

Personal budget tracker PWA for a two-person household. Import bank statements
(CSV, OFX or QIF — the bank format is auto-detected), get auto-categorised
transactions (rules that learn from your corrections), budgets that can roll
over, goals, a cash-flow forecast with "safe to spend until payday", trends,
and one Recurring list — hand-added bills (with Discord and push reminders)
plus automatically detected subscriptions. Couples features: split shared
costs and settle up, comment on each other's transactions, Joint goals and a
monthly Recap. Plus an Australian tax module and an "Ask Tally" assistant.

See `docs/competitive-analysis.md` for how this stacks up against YNAB,
Monarch, PocketSmith, Frollo and friends, and why these features exist.

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

### Upgrading to v9 (roadmap features)

Run `supabase/schema.sql` again **before** deploying this version. It only
adds things: `splits`/`shared` on transactions, `rollover` on budgets, `kind`
on accounts, and new tables for goals, comments, forecast settings, balance
history, push subscriptions and the push send-log. Existing accounts default to
kind "Everyday" — set super/savings/credit cards on the Accounts screen so the
forecast spends only from everyday accounts and net worth counts debts.

## Ask Tally (Claude)

The Ask screen calls the `tally-ask` Supabase Edge Function, which calls the
Claude API. It sends only aggregates (monthly category totals, budgets, goals,
bills, balances by type, top merchants, the forecast summary) — never raw
transactions, notes or account numbers.

```
supabase functions deploy tally-ask          # JWT verification stays on
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Without the secret the screen shows "Ask is not set up yet". The demo build
answers with a canned reply and makes no network calls.

## Push notifications

Web Push for bills due within 3 days, budgets passing 90% / going over, and
newly spotted subscriptions or price rises. Each alert is sent once (tracked in
`budget_push_log`). On iPhone, push only works once Tally is added to the Home
Screen (iOS 16.4+).

1. VAPID keys: this project already has `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
   and `VAPID_SUBJECT` set as Edge Function secrets (shared with Orbit's
   `notify` function). On a fresh project, create them with
   `npx web-push generate-vapid-keys` and `supabase secrets set ...`.
2. Vercel env: `VITE_VAPID_PUBLIC_KEY=<the same public key>` (redeploy).
3. Run `supabase/schema.sql` — it generates the schedule password straight
   into Vault (`tally_push_cron_secret`); nobody needs to copy it anywhere.
4. Deploy and schedule (enable `pg_cron` and `pg_net` first). 21:05 UTC is
   8:05 AM Melbourne in daylight time (7:05 AM otherwise):
   ```
   supabase functions deploy tally-push --no-verify-jwt
   ```
   ```sql
   select cron.schedule('tally-push-daily', '5 21 * * *', $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/tally-push',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tally_push_cron_secret')
       ),
       body := '{}'::jsonb
     )
   $$);
   ```
5. Each person turns notifications on in Settings → Notifications, per device.

## Discord bill reminders

The household bot (`../discord-household-bot/tally_bills.py`) reads
`budget_bills` daily at 8:05 AM Melbourne and posts bills due within 3 days to
the bills channel. It needs `TALLY_SUPABASE_URL` + `TALLY_SUPABASE_SERVICE_KEY`
in the bot's `.env` (service key: Dashboard → Project Settings → API keys →
service_role). Until the key is set, the loop silently skips.
