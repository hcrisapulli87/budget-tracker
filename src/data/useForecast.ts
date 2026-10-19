import { useCallback, useEffect, useMemo, useState } from 'react'
import { useData } from './DataProvider'
import { fetchAccounts } from './accounts'
import { fetchBills } from './bills'
import { fetchSubscriptions } from './subscriptions'
import { fetchTransactions } from './transactions'
import { DEFAULT_BUFFER, fetchForecastSettings } from './forecastSettings'
import { useRealtime } from './useRealtime'
import { visibleTo } from '../domain/ownership'
import { buildRecurring } from '../domain/recurring'
import { dailyDiscretionary, detectPayCycle, projectBalance, projectEvents, safeToSpend } from '../domain/forecast'
import type { Forecast, ForecastEvent, PayCycle, SafeToSpend } from '../domain/forecast'
import { isSpendable, signedBalance } from '../domain/netWorth'
import { addDaysIso, isoToday } from '../domain/money'
import type { Account, Bill, ForecastSettings, Subscription, Txn } from './types'

export interface ForecastState {
  ready: boolean
  /** spendable accounts the forecast starts from */
  accounts: Account[]
  startBalance: number
  /** oldest balance date among those accounts — how fresh the starting point is */
  asOf: string | null
  pay: PayCycle | null
  detectedPay: PayCycle | null
  settings: ForecastSettings | null
  buffer: number
  dailySpend: number
  events: ForecastEvent[]
  forecast: Forecast | null
  safe: SafeToSpend | null
  reload: () => void
}

/** Everything the forecast and "safe to spend" need, for the viewed person. */
export function useForecast(days = 60): ForecastState {
  const { categories, viewId } = useData()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [txns, setTxns] = useState<Txn[]>([])
  const [settings, setSettings] = useState<ForecastSettings | null>(null)
  const [ready, setReady] = useState(false)
  const today = isoToday()

  const load = useCallback(() => {
    if (!viewId) return
    void Promise.all([
      fetchAccounts().then((a) => setAccounts(visibleTo(a, viewId).filter((x) => !x.is_archived && isSpendable(x)))).catch(() => setAccounts([])),
      fetchBills().then((b) => setBills(visibleTo(b, viewId))).catch(() => setBills([])),
      fetchSubscriptions().then((s) => setSubs(s.filter((x) => x.owner_id === viewId))).catch(() => setSubs([])),
      fetchTransactions(addDaysIso(today, -120), today, viewId).then(setTxns).catch(() => setTxns([])),
      fetchForecastSettings(viewId).then(setSettings).catch(() => setSettings(null)),
    ]).then(() => setReady(true))
  }, [viewId, today])
  useEffect(load, [load])
  useRealtime(['budget_accounts', 'budget_bills', 'budget_subscriptions', 'budget_settings'], load)

  return useMemo(() => {
    const excluded = new Set(categories.filter((c) => c.exclude_from_analytics).map((c) => c.id))
    const items = buildRecurring(bills, subs)
    const counted = txns.filter((t) => !(t.category_id && excluded.has(t.category_id)))
    const detectedPay = detectPayCycle(counted, today)
    const manual: PayCycle | null =
      settings?.pay_cadence && settings.pay_amount && settings.next_payday
        ? { cadence: settings.pay_cadence, amount: settings.pay_amount, nextPayday: settings.next_payday, payer: null, source: 'manual' }
        : null
    const pay = manual ?? detectedPay
    const recurringMerchants = new Set(subs.filter((s) => s.status === 'confirmed').map((s) => s.merchant_norm))
    const dailySpend = dailyDiscretionary(txns, addDaysIso(today, -90), addDaysIso(today, -1), excluded, recurringMerchants)
    const startBalance = Math.round(accounts.reduce((s, a) => s + signedBalance(a), 0) * 100) / 100
    const dates = accounts.map((a) => a.balance_as_of).filter((d): d is string => !!d).sort()
    const buffer = settings?.buffer ?? DEFAULT_BUFFER
    const events = projectEvents(items, pay, today, addDaysIso(today, days))
    const hasBalance = accounts.some((a) => a.balance !== null)
    return {
      ready,
      accounts,
      startBalance,
      asOf: dates[0] ?? null,
      pay,
      detectedPay,
      settings,
      buffer,
      dailySpend,
      events,
      forecast: hasBalance ? projectBalance(startBalance, today, days, events, dailySpend) : null,
      safe: hasBalance && pay ? safeToSpend(startBalance, today, pay.nextPayday, events, buffer) : null,
      reload: load,
    }
  }, [categories, bills, subs, txns, settings, accounts, ready, today, days, load])
}
