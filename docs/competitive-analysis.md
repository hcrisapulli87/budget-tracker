# Tally: competitive analysis and improvement roadmap

*October 2026. Desk research plus a review of the Tally codebase at `88ed470`.*

## Status (v9, October 2026)

| # | Roadmap item | Status |
|---|---|---|
| 1 | Up Bank live sync | **Dropped**: we don't bank with Up |
| 2 | Lower-friction imports | **Shipped**: bank auto-detect, OFX/QFX/QIF, several files at once, per-bank export help, "import due" nudge on Home |
| 3 | Rollover budgets + sinking funds | **Shipped**: per-category rollover; a Sinking Funds card built from quarterly/annual bills |
| 4 | Split transactions | **Shipped**: split editor; each part counts towards its own budget and trend |
| 5 | Cash-flow forecast + safe to spend | **Shipped**: Forecast screen, pay cycle detected (or set by hand), 60-day balance chart, Home card |
| 6 | Couples layer 2.0 | **Shipped**: Joint goals, comments on transactions, shared costs with settle-up, monthly Recap |
| 7 | Web Push notifications | **Shipped**: bills, budgets and subscriptions alerts, each with its own toggle (needs VAPID keys and a daily schedule, see README) |
| 8 | Tax-time autopilot | **Shipped**: estimate of what deductions are worth back, missing-receipt list with attach, accountant pack (.zip) |
| 9 | Ask Tally (AI) | **Shipped**: Claude via a Supabase Edge Function, aggregates only (needs `ANTHROPIC_API_KEY`, see README) |
| 10 | Net worth incl. super/investments | **Shipped**: account types, debts counted as negative, 12-month net-worth chart |
| 11 | CDR intermediary feeds | **Deferred**: costs money and carries compliance obligations; only worth it if Tally goes beyond one household |

## 1. Summary

Tally is already stronger than most competitors in three areas: **Australian tax
time** (FY-aware deductions, WFH and vehicle calculators, a receipt vault, an EOFY
checklist), **privacy** (no bank credentials are ever shared) and a **two-person
ownership model**. Where it falls behind is the "money runs itself" experience
the market leaders sell:

1. **Getting data in takes work.** Every competitor syncs automatically. Tally needs
   a CSV export from each bank, so the data is only as fresh as the last import.
2. **It looks backward, not forward.** It has no cash-flow forecast, no
   "safe to spend" figure and no payday-based view.
3. **Budgets are basic.** Each category gets a monthly limit and a pace status.
   There are no rollovers, no sinking funds and no goals beyond one optional
   savings goal per account.
4. **It's thin as a *couples* app.** Since v7, Tally gives each partner a
   private space and a read-only view of the other's. Nobody owes anything,
   there's no shared plan, and partners can't comment on transactions.

The recommended plan (section 6) closes gaps 1–4 in that order of value, and
leans into the AU tax and couples angles that no single competitor covers well.

## 2. The competitive set

| App | Market | Price (approx.) | Positioning | Bank sync |
|---|---|---|---|---|
| **YNAB** | Global (USD) | US$109/yr | Zero-based "give every dollar a job" | Plaid etc.; weak in AU, many AU users import files |
| **Monarch Money** | US-first | US$99.99/yr Core, $199 Plus | Best all-round app for couples/households; AI assistant, goals, forecasting (Plus) | US aggregators |
| **Copilot Money** | US, Apple | US$95/yr | Polished design, ML categorisation that learns from corrections | US aggregators |
| **PocketSmith** | NZ/AU (AU is its biggest market, ~100k users) | Free; ~A$84–224/yr paid | Calendar-based cash-flow **forecasting** up to decades ahead | CDR + scraping |
| **Frollo** | AU | Free | CDR-accredited, 100+ providers, Frollo Score, "Financial Passport" export | CDR |
| **WeMoney** | AU | Free / Pro ~A$9.99/mo | Budgeting + Equifax credit score + net wealth | CDR |
| **Up (bank)** | AU | Free (it's a bank) | Budgeting built into the bank: Savers, "2Up" joint accounts | Native |
| **Honeydue** | US-first | Free | Couples-only, per-account privacy controls, comments on transactions | Aggregators |

## 3. Feature comparison

✅ strong · ◐ partial · ❌ none

| Capability | Tally | YNAB | Monarch | Copilot | PocketSmith | Frollo | Honeydue |
|---|---|---|---|---|---|---|---|
| Automatic bank sync | ❌ (CSV, 6 AU bank formats) | ◐ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Learned auto-categorisation | ✅ rules learn from corrections | ◐ | ✅ | ✅ | ◐ | ◐ | ◐ |
| Subscription / recurring detection | ✅ with price-rise flags | ◐ | ✅ | ✅ | ◐ | ✅ | ◐ |
| Bill reminders | ✅ (Discord bot) | ◐ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Category budgets | ◐ monthly limit + pace | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rollover / sinking funds | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Goals | ◐ one per account | ✅ | ✅ | ◐ | ✅ | ✅ | ❌ |
| Cash-flow forecast | ❌ | ❌ | ✅ (Plus) | ◐ | ✅ best-in-class | ❌ | ❌ |
| Net worth | ◐ account balances | ◐ | ✅ incl. investments | ✅ | ✅ | ✅ | ❌ |
| Couples: shared view | ◐ read-only partner view | ◐ shared plan | ✅ | ❌ | ◐ | ❌ | ✅ |
| Couples: comments / split / settle up | ❌ (settlements removed in v7) | ❌ | ◐ | ❌ | ❌ | ❌ | ✅ |
| Split one transaction across categories | ❌ | ✅ | ✅ | ✅ | ✅ | ◐ | ❌ |
| Insights / AI | ◐ 4 rule-based observations | ❌ | ✅ AI assistant | ◐ | ◐ | ◐ | ❌ |
| **AU tax: deductions, WFH, vehicle, EOFY** | ✅ **unique** | ❌ | ❌ | ❌ | ◐ tagging | ❌ | ❌ |
| Receipt vault | ✅ (tax) | ❌ | ✅ (receipt scan) | ❌ | ✅ attachments | ❌ | ❌ |
| Privacy (no bank credentials) | ✅ | ◐ | ❌ | ❌ | ❌ | ◐ CDR | ❌ |
| Price | Free / self-hosted | Paid | Paid | Paid | Freemium | Free | Free |

## 4. Where Tally wins today (protect and promote)

- **AU tax workflow.** None of the competitors turn a year of transactions into a
  deduction list with ATO-style WFH and vehicle calculators, a receipt vault and
  an EOFY checklist. This is the clearest differentiator.
- **Categorisation that learns** from your corrections (`domain/ruleEngine.ts`),
  with re-scan and a review nudge. It's on par with Copilot's main selling point.
- **Subscription intelligence.** Price-creep, unused-sub and streaming-overlap
  insights (`domain/insights.ts`) go further than most AU apps.
- **Privacy by design.** No bank credentials or screen-scraping. Row-Level
  Security keeps tax records owner-only.
- **AU bank formats handled properly**: CommBank, Westpac, NAB, Macquarie, ING,
  combined multi-account exports and duplicate-safe imports.

## 5. Gap analysis

| # | Gap | User impact | Who does it well |
|---|---|---|---|
| G1 | Manual CSV import | Data goes stale, and "I'll import later" is how people abandon budgeting apps | Everyone |
| G2 | No forward view | Can't answer "Can we afford X before payday?" | PocketSmith, Monarch Plus |
| G3 | Budgets have no memory | Irregular costs (rego, insurance, Christmas) blow a month's budget every time | YNAB, Monarch |
| G4 | Thin couples layer | Each partner sees the other's money but can't coordinate | Honeydue, Monarch |
| G5 | No split transactions | A Woolworths shop that's half groceries, half household is categorised wrong | YNAB, Monarch, Copilot |
| G6 | Notifications only via Discord | Hard to share beyond your own household, and no budget alerts | Everyone (push) |
| G7 | Insights are few and static | Less "aha" value than an AI assistant | Monarch |
| G8 | Net worth excludes super/investments | Incomplete for an AU household, where super is often the biggest asset | WeMoney, Monarch |

## 6. Recommended roadmap

Ranked by value ÷ effort. Effort: S = days, M = 1–2 weeks, L = more.

### Now (highest value, fits the current architecture)

1. **Up Bank live sync (M)**: closes G1 for Up customers. Up has a free
   personal-access-token API with transaction **webhooks**, so a Supabase Edge
   Function can receive new transactions in real time and run them through the
   existing rule engine. There's no accreditation burden, and the token stays
   server-side. Up's 2Up accounts also fit the Joint model.
2. **Lower-friction imports (S)** for the other banks: drag in several CSVs at
   once, auto-detect the bank profile, OFX/QIF support, an "import due — last one
   was 12 days ago" nudge on Home, and per-bank export instructions.
3. **Rollover budgets + sinking funds (M)**, closing G3. Unspent (or overspent)
   amounts carry forward. Annual bills become a monthly "set aside" target, built
   on the existing `normaliseCadence` and Recurring list. Extends `budgetMath.ts`.
4. **Split transactions (S–M)**, closing G5: a `budget_txn_splits` child table, a
   split sheet in TxnSheet, and analytics that read splits where they exist.

### Next (the differentiators)

5. **Cash-flow forecast + "safe to spend" (M)**, closing G2 and the biggest
   upgrade to Home. Project balances forward from the Recurring list, average
   income and pay cycle (weekly/fortnightly cadences already exist), and show a
   "safe to spend until payday" figure. This is PocketSmith's headline feature,
   delivered in a simpler form.
6. **Couples layer 2.0 (M)**, closing G4 while keeping the private-by-default model:
   - Opt-in **shared budgets/goals** (e.g. "Holiday – Japan", "Groceries") that
     both partners' tagged transactions count towards.
   - **Comments and reactions** on transactions ("what was this?").
   - Bring back a lightweight **settle-up** for shared costs paid by one person.
     The `budget_settlements` table is still in the schema.
   - A monthly **"money date" summary** for both partners: what changed, what's due, how goals are tracking.
7. **Web Push notifications (S–M)**, closing G6: iOS PWAs support push since iOS 16.4.
   Covers bills due, a budget going "hot", a new subscription detected or a price rise.
   Keep Discord as an optional channel.

### Later (deepen the moat)

8. **Tax-time autopilot (M)**: extend the unique tax module. Suggest deductions all
   year round, flag work-related transactions that have no receipt, and give a
   projected refund/estimate and a one-tap accountant pack (CSV + receipts zip).
9. **AI insights / ask-your-money (M)**: a Claude-powered "ask about your money"
   assistant over the user's own aggregates (not raw descriptions by default), and
   richer monthly narratives. Keep the existing "observations, not verdicts" tone.
10. **Net worth incl. super and investments (S)**: manual or periodic-balance assets
    with a history chart. This closes G8 without needing data feeds.
11. **Broader open banking via a CDR intermediary (L)**: an accredited
    intermediary under the CDR "representative" model can provide feeds for all
    major AU banks. It costs money, carries compliance obligations and only makes
    sense if Tally goes beyond one household. For a personal app, Up sync (#1) plus
    better imports (#2) get most of the value.

## 7. Positioning

> **Tally — the private, Australian money app for two.**
> Learns how you categorise, catches subscription creep, tells you what's safe to
> spend before payday, and has your tax return ready by July.

None of the competitors offer **AU tax readiness + couples + privacy** together:
PocketSmith has forecasting but no tax or couples layer. Frollo has AU feeds but
shallow budgeting. Honeydue and Monarch are US-centric. Shipping items 1–7 makes
Tally clearly better than all of them for an Australian household.

## 8. Success metrics

- **Freshness:** median days since the last transaction landed (target < 2 with Up sync, < 7 otherwise).
- **Categorisation:** % of transactions auto-categorised and never corrected (target > 90%).
- **Engagement:** weekly active days per person, and use of the partner view or comments.
- **Outcome:** months where the forecast's "safe to spend" figure was never breached, and savings-goal progress.

## Sources

- Mozo, *Seven best budgeting and savings apps 2026*: https://mozo.com.au/fintech/the-seven-budget-and-savings-apps-every-aussie-needs
- Finny, *Best budgeting apps in Australia for 2026*: https://getfinny.app/blog/best-budgeting-apps-australia-2026
- Finny, *Best budgeting apps for couples 2026*: https://getfinny.app/blog/best-budgeting-apps-for-couples-2026
- Peakifi, *Best budgeting apps Australia (2026)*: https://peakifi.com/personal-finance/budgeting/budgeting-apps/
- Asian Efficiency, *Copilot vs Monarch vs YNAB*: https://www.asianefficiency.com/technology/copilot-money-vs-monarch-vs-ynab/
- envelopebudgeting.com, *YNAB vs Monarch 2026*: https://envelopebudgeting.com/articles/monarch-vs-ynab
- The Penny Hoarder, *Monarch Money review 2026*: https://www.thepennyhoarder.com/budgeting/monarch-money-review/
- Releasebot, *Monarch release notes*: https://releasebot.io/updates/monarch
- PricingSaaS, *PocketSmith pricing*: https://pricingsaas.com/companies/pocketsmith
- FinTech Australia, *PocketSmith and open banking*: https://www.fintechaustralia.org.au/newsroom/pocketsmiths-global-spending-map-highlights-where-australians-can-benefit-most-from-open-banking-data
- Moneymag, *Five apps to help you budget*: https://www.moneymag.com.au/five-apps-to-help-you-budget-and-manage-your-money
- Experian, *Honeydue review*: https://www.experian.com/blogs/ask-experian/honeydue-app-review/
- Clark, *Honeydue*: https://clark.com/personal-finance-credit/budgeting-saving/honeydue/
- ToolDirectory, *Copilot Money*: https://tooldirectory.ai/tools/copilot-money
- Up Banking API: https://github.com/up-banking/api

Prices and features come from third-party reviews (several earn affiliate
income) and should be checked against vendor sites before quoting.
