import { describe, it, expect } from 'vitest'
import { dailyDiscretionary, detectPayCycle, projectBalance, projectEvents, rollForward, safeToSpend, stepDate } from './forecast'
import { buildRecurring } from './recurring'
import type { Bill, Subscription } from '../data/types'

const bill = (over: Partial<Bill>): Bill => ({
  id: 'b', owner_id: null, name: 'Rent', amount: 2000, is_estimate: false, frequency: 'monthly',
  due_day: 1, next_due: '2026-11-01', autopay: true, category_id: null, last_paid: null, ...over,
})
const sub = (over: Partial<Subscription>): Subscription => ({
  id: 's', owner_id: 'me', merchant_norm: 'netflix', name: 'Netflix', cadence: 'monthly', amount: 20,
  price_history: [], next_expected: '2026-10-25', status: 'confirmed', ...over,
})

describe('stepDate / rollForward', () => {
  it('keeps the day of month and clamps short months', () => {
    expect(stepDate('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(stepDate('2026-10-18', 'fortnightly')).toBe('2026-11-01')
    expect(rollForward('2026-09-01', 'monthly', '2026-10-18')).toBe('2026-11-01')
  })
})

describe('detectPayCycle', () => {
  it('finds a fortnightly salary and the next payday after today', () => {
    const pay = ['2026-08-27', '2026-09-10', '2026-09-24', '2026-10-08'].map((d, i) => ({
      merchant_norm: 'acme payroll', txn_date: d, amount: 2400 + i * 10,
    }))
    const refund = { merchant_norm: 'refund', txn_date: '2026-10-01', amount: 30 }
    const cycle = detectPayCycle([...pay, refund], '2026-10-18')
    expect(cycle).toMatchObject({ cadence: 'fortnightly', nextPayday: '2026-10-22', payer: 'acme payroll', source: 'detected' })
    expect(cycle!.amount).toBe(2420)
  })
  it('ignores irregular deposits and streams that stopped', () => {
    expect(detectPayCycle([
      { merchant_norm: 'old job', txn_date: '2026-03-01', amount: 3000 },
      { merchant_norm: 'old job', txn_date: '2026-03-15', amount: 3000 },
      { merchant_norm: 'old job', txn_date: '2026-03-29', amount: 3000 },
    ], '2026-10-18')).toBeNull()
  })
})

describe('projectEvents', () => {
  it('rolls bills, subs and pay across the window; an overdue bill lands today', () => {
    const items = buildRecurring(
      [bill({}), bill({ id: 'power', name: 'Power', amount: 300, frequency: 'quarterly', next_due: '2026-10-10', autopay: false })],
      [sub({})],
    )
    const events = projectEvents(items, { cadence: 'fortnightly', amount: 2400, nextPayday: '2026-10-22', payer: null, source: 'manual' }, '2026-10-18', '2026-11-30')
    expect(events.map((e) => `${e.date} ${e.label}`)).toEqual([
      '2026-10-18 Power',
      '2026-10-22 Pay',
      '2026-10-25 Netflix',
      '2026-11-01 Rent',
      '2026-11-05 Pay',
      '2026-11-19 Pay',
      '2026-11-25 Netflix',
    ])
  })
})

describe('projectBalance + safeToSpend', () => {
  const events = [
    { date: '2026-10-20', amount: -500, label: 'Rent', kind: 'bill' as const },
    { date: '2026-10-22', amount: 2400, label: 'Pay', kind: 'pay' as const },
  ]
  it('tracks the lowest point before pay lands', () => {
    const f = projectBalance(1000, '2026-10-18', 6, events, 50)
    expect(f.lowest).toEqual({ date: '2026-10-21', balance: 350 })
    expect(f.end.balance).toBe(2600)
  })
  it('leaves balance minus commitments minus buffer, spread over the days to payday', () => {
    expect(safeToSpend(1000, '2026-10-18', '2026-10-22', events, 100)).toEqual({ amount: 400, perDay: 100, daysToPayday: 4, committed: 500 })
  })
})

describe('safeToSpend with nothing due', () => {
  it('reports zero (not negative zero) committed', () => {
    expect(Object.is(safeToSpend(500, '2026-10-18', '2026-10-20', [], 0).committed, 0)).toBe(true)
  })
})

describe('dailyDiscretionary', () => {
  it('averages non-recurring, non-excluded spend per day', () => {
    const txns = [
      { txn_date: '2026-10-01', amount: -30, category_id: 'food', merchant_norm: 'cafe' },
      { txn_date: '2026-10-02', amount: -20, category_id: 'xfer', merchant_norm: 'transfer' },
      { txn_date: '2026-10-03', amount: -20, category_id: 'subs', merchant_norm: 'netflix' },
      { txn_date: '2026-10-09', amount: -70, category_id: 'food', merchant_norm: 'woolworths' },
      { txn_date: '2026-10-05', amount: 999, category_id: 'inc', merchant_norm: 'pay' },
    ]
    expect(dailyDiscretionary(txns, '2026-10-01', '2026-10-10', new Set(['xfer']), new Set(['netflix']))).toBe(10)
  })
})
