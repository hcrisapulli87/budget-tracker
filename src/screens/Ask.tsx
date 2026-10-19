import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { useForecast } from '../data/useForecast'
import { askTally } from '../data/ask'
import type { AskTurn } from '../data/ask'
import { fetchTransactions } from '../data/transactions'
import { fetchGoals } from '../data/goals'
import { fetchBills } from '../data/bills'
import { fetchSubscriptions } from '../data/subscriptions'
import { fetchAccounts } from '../data/accounts'
import { buildAskContext } from '../domain/askContext'
import { expandSplits } from '../domain/splits'
import { buildRecurring } from '../domain/recurring'
import { shiftMonth } from '../domain/budgetMath'
import { visibleTo } from '../domain/ownership'
import { isoToday } from '../domain/money'
import type { Account, Bill, Goal, Subscription, Txn } from '../data/types'

const SUGGESTIONS = [
  'Where could I cut back next month?',
  'Can I afford a $1,500 holiday in December?',
  'How am I tracking on my goals?',
  'What changed in my spending this month?',
  'Which subscriptions cost the most per year?',
]

/** Ask Tally — plain-English questions about your own money, answered by Claude. */
export default function Ask() {
  const { user } = useAuth()
  const { categories, budgets, viewId, readOnly } = useData()
  const forecast = useForecast(60)
  const [txns, setTxns] = useState<Txn[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [turns, setTurns] = useState<AskTurn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const today = isoToday()
  const myId = user?.id ?? ''

  useEffect(() => {
    if (!myId) return
    fetchTransactions(`${shiftMonth(today.slice(0, 7), -5)}-01`, today, myId).then(setTxns).catch(() => setTxns([]))
    fetchGoals().then((g) => setGoals(visibleTo(g, myId).filter((x) => !x.is_archived))).catch(() => setGoals([]))
    fetchBills().then((b) => setBills(visibleTo(b, myId))).catch(() => setBills([]))
    fetchSubscriptions().then((s) => setSubs(s.filter((x) => x.owner_id === myId))).catch(() => setSubs([]))
    fetchAccounts().then((a) => setAccounts(visibleTo(a, myId))).catch(() => setAccounts([]))
  }, [myId, today])

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [turns, busy])

  // Ask is always about your own money — the forecast hook follows the switcher, so only use it for you.
  const context = useMemo(
    () => buildAskContext({
      today,
      expanded: expandSplits(txns),
      txns,
      categories,
      budgets: readOnly ? [] : budgets,
      goals,
      recurring: buildRecurring(bills, subs),
      accounts,
      pay: viewId === myId ? forecast.pay : null,
      safe: viewId === myId ? forecast.safe : null,
      forecast: viewId === myId ? forecast.forecast : null,
    }),
    [today, txns, categories, budgets, readOnly, goals, bills, subs, accounts, forecast, viewId, myId],
  )

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    setError('')
    setDraft('')
    const history = turns
    setTurns([...history, { role: 'user', content: q }])
    setBusy(true)
    try {
      const answer = await askTally(q, context, history)
      setTurns((t) => [...t, { role: 'assistant', content: answer }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setTurns(history)
      setDraft(q)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Ask Tally</h1>
        {turns.length > 0 && <button className="btn btn--small" onClick={() => setTurns([])}>New chat</button>}
      </div>
      <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
        Ask about your money in plain English. Tally sends a summary — monthly totals by category, budgets, goals, bills, balances and top merchants — never individual transactions, notes or account numbers. Answers are general information, not financial advice.
      </p>

      {turns.length === 0 && (
        <div className="card">
          <h2>Try</h2>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => void ask(s)}>{s}</button>)}
          </div>
        </div>
      )}

      <div>
        {turns.map((t, i) => (
          <div key={i} className={`chat-bubble ${t.role === 'user' ? 'chat-bubble--me' : 'chat-bubble--tally'}`}>{t.content}</div>
        ))}
        {busy && <div className="chat-bubble chat-bubble--tally muted">Thinking…</div>}
        <div ref={endRef} />
      </div>
      {error && <p className="error">{error}</p>}

      <div className="row" style={{ position: 'sticky', bottom: 'calc(84px + env(safe-area-inset-bottom))', marginTop: 10 }}>
        <input className="input" placeholder="Ask about your spending, bills, goals…" value={draft} maxLength={500}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void ask(draft) }} />
        <button className="btn btn--primary" disabled={busy || !draft.trim()} onClick={() => void ask(draft)}>Ask</button>
      </div>
    </div>
  )
}
