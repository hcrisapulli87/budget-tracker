import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataProvider'
import { useForecast } from '../data/useForecast'
import { DEFAULT_BUFFER, saveForecastSettings } from '../data/forecastSettings'
import { addDaysIso, formatAUD, formatDayMonth, isoToday } from '../domain/money'
import { countdown } from '../domain/recurring'
import { LineChart } from '../components/ui/LineChart'
import { PersonSwitcher } from '../components/PersonSwitcher'
import { EmptyState } from '../components/ui/EmptyState'
import type { PayCadence } from '../data/types'

/** Where your everyday balance is heading, and what's safe to spend before payday. */
export default function Forecast() {
  const { viewId, readOnly } = useData()
  const f = useForecast(60)
  const [editing, setEditing] = useState(false)
  const today = isoToday()

  const upcoming = f.events.filter((e) => e.date <= addDaysIso(today, 30))

  return (
    <div className="screen">
      <div className="row--between">
        <h1 className="brand">Forecast</h1>
        <PersonSwitcher />
      </div>

      {f.ready && f.accounts.every((a) => a.balance === null) ? (
        <EmptyState icon="🔮" title="No balances yet" hint={readOnly ? undefined : 'Import a statement with a balance column, or set your everyday account balance on Accounts.'} />
      ) : (
        <>
          <div className="hero hero--tint" style={{ cursor: 'default' }}>
            <div className="hero__label">Safe to spend{f.pay ? ` until payday · ${formatDayMonth(f.pay.nextPayday)}` : ''}</div>
            {f.safe ? (
              <>
                <div className={`stat${f.safe.amount < 0 ? ' error' : ''}`}>{formatAUD(f.safe.amount)}</div>
                <div className="txn__sub" style={{ whiteSpace: 'normal' }}>
                  ~{formatAUD(f.safe.perDay)}/day for {f.safe.daysToPayday} day{f.safe.daysToPayday === 1 ? '' : 's'} · after {formatAUD(f.safe.committed)} of bills and a {formatAUD(f.buffer)} buffer
                </div>
              </>
            ) : (
              <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
                Tally couldn't spot a regular pay in your statements yet.{!readOnly && ' Tell it when you get paid below.'}
              </p>
            )}
          </div>

          {f.forecast && (
            <div className="card">
              <div className="row--between">
                <h2>Everyday balance · next 60 days</h2>
              </div>
              <LineChart
                label="Projected everyday balance"
                points={f.forecast.points.map((p) => ({ x: p.date, y: p.balance }))}
                formatX={formatDayMonth}
                formatY={formatAUD}
                markLowest
              />
              <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
                Lowest point <strong className={f.forecast.lowest.balance < 0 ? 'error' : ''}>{formatAUD(f.forecast.lowest.balance)}</strong> on {formatDayMonth(f.forecast.lowest.date)}
                {f.forecast.lowest.balance < 0 && ' — you may need to move money across before then.'}
                <br />
                Starts from {formatAUD(f.startBalance)} across {f.accounts.length} everyday account{f.accounts.length === 1 ? '' : 's'}{f.asOf ? ` (balances as at ${formatDayMonth(f.asOf)})` : ''}, with ~{formatAUD(f.dailySpend)}/day of day-to-day spending.
              </p>
            </div>
          )}

          <div className="card">
            <div className="row--between">
              <h2>Next 30 days</h2>
              <Link to="/recurring" className="txn__sub">recurring →</Link>
            </div>
            {upcoming.length === 0 && <p className="txn__sub">Nothing scheduled.</p>}
            {upcoming.map((e, i) => (
              <div key={`${e.date}-${e.label}-${i}`} className="event-row">
                <span>{e.kind === 'pay' ? '💰' : e.kind === 'sub' ? '🔁' : '🧾'} {e.label} <span className="txn__sub">· {formatDayMonth(e.date)} · {countdown(e.date, today)}</span></span>
                <span className={`amount ${e.amount > 0 ? 'amount--pos' : ''}`}>{formatAUD(e.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card">
        <div className="row--between">
          <h2>Pay cycle</h2>
          {!readOnly && <button className="btn btn--small" onClick={() => setEditing((v) => !v)}>{editing ? 'Cancel' : 'Edit'}</button>}
        </div>
        {f.pay ? (
          <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
            {formatAUD(f.pay.amount)} {f.pay.cadence} · next {formatDayMonth(f.pay.nextPayday)} ·{' '}
            {f.pay.source === 'detected' ? `spotted from "${f.pay.payer}" in your statements` : 'set by you'}
          </p>
        ) : (
          <p className="txn__sub">Not known yet.</p>
        )}
        {editing && !readOnly && (
          <PaySettings
            ownerId={viewId}
            initial={{
              cadence: f.settings?.pay_cadence ?? f.detectedPay?.cadence ?? 'fortnightly',
              amount: f.settings?.pay_amount ?? f.detectedPay?.amount ?? null,
              next: f.settings?.next_payday ?? f.detectedPay?.nextPayday ?? today,
              buffer: f.settings?.buffer ?? DEFAULT_BUFFER,
              manual: !!f.settings?.pay_cadence,
            }}
            onSaved={() => { setEditing(false); f.reload() }}
          />
        )}
      </div>

      <p className="txn__sub" style={{ whiteSpace: 'normal' }}>
        A projection, not a promise: it assumes your bills, subscriptions and pay keep their rhythm and day-to-day spending stays near its 90-day average.
      </p>
    </div>
  )
}

function PaySettings({ ownerId, initial, onSaved }: {
  ownerId: string
  initial: { cadence: PayCadence; amount: number | null; next: string; buffer: number; manual: boolean }
  onSaved: () => void
}) {
  const [manual, setManual] = useState(initial.manual)
  const [cadence, setCadence] = useState<PayCadence>(initial.cadence)
  const [amount, setAmount] = useState(initial.amount != null ? String(initial.amount) : '')
  const [next, setNext] = useState(initial.next)
  const [buffer, setBuffer] = useState(String(initial.buffer))
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const pay = Number(amount)
    const buf = Number(buffer)
    if (manual && (!Number.isFinite(pay) || pay <= 0 || !next)) return
    setBusy(true)
    try {
      await saveForecastSettings({
        owner_id: ownerId,
        pay_cadence: manual ? cadence : null,
        pay_amount: manual ? pay : null,
        next_payday: manual ? next : null,
        buffer: Number.isFinite(buf) && buf >= 0 ? buf : DEFAULT_BUFFER,
      })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="row"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Set my pay myself (instead of detecting it)</label>
      {manual && (
        <>
          <select className="input" value={cadence} onChange={(e) => setCadence(e.target.value as PayCadence)}>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input className="input" type="number" inputMode="decimal" placeholder="Take-home pay" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <label className="muted">Next payday</label>
          <input className="input" type="date" value={next} onChange={(e) => setNext(e.target.value)} />
        </>
      )}
      <label className="muted">Safety buffer (kept out of "safe to spend")</label>
      <input className="input" type="number" inputMode="decimal" value={buffer} onChange={(e) => setBuffer(e.target.value)} />
      <button className="btn btn--primary" disabled={busy} onClick={() => void save()}>Save</button>
    </div>
  )
}
