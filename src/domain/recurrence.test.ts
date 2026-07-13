import { describe, expect, it } from 'vitest'
import { detectRecurring } from './recurrence'

const t = (merchant_norm: string, txn_date: string, amount: number) => ({ merchant_norm, txn_date, amount })

describe('detectRecurring', () => {
  it('detects a monthly subscription and predicts the next charge', () => {
    const out = detectRecurring([
      t('netflix', '2026-04-15', -18.99),
      t('netflix', '2026-05-15', -18.99),
      t('netflix', '2026-06-15', -18.99),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ merchantNorm: 'netflix', cadence: 'monthly', amount: 18.99 })
    expect(out[0].nextExpected).toBe('2026-07-15')
  })
  it('tolerates small amount changes within 10%', () => {
    const out = detectRecurring([
      t('spotify', '2026-04-01', -11.99),
      t('spotify', '2026-05-01', -12.99),
      t('spotify', '2026-06-01', -12.99),
    ])
    expect(out).toHaveLength(1)
  })
  it('requires at least 3 occurrences', () => {
    expect(detectRecurring([t('stan', '2026-05-01', -10), t('stan', '2026-06-01', -10)])).toHaveLength(0)
  })
  it('rejects irregular intervals (groceries are not a subscription)', () => {
    expect(
      detectRecurring([
        t('woolworths', '2026-06-01', -50),
        t('woolworths', '2026-06-04', -52),
        t('woolworths', '2026-06-20', -49),
      ]),
    ).toHaveLength(0)
  })
  it('rejects wildly varying amounts', () => {
    expect(
      detectRecurring([
        t('amazon', '2026-04-10', -20),
        t('amazon', '2026-05-10', -90),
        t('amazon', '2026-06-10', -35),
      ]),
    ).toHaveLength(0)
  })
  it('detects weekly and annual cadences', () => {
    const weekly = detectRecurring([
      t('gym', '2026-06-01', -25),
      t('gym', '2026-06-08', -25),
      t('gym', '2026-06-15', -25),
    ])
    expect(weekly[0]?.cadence).toBe('weekly')
    const annual = detectRecurring([
      t('domain renewal', '2024-06-01', -20),
      t('domain renewal', '2025-06-01', -20),
      t('domain renewal', '2026-06-01', -20),
    ])
    expect(annual[0]?.cadence).toBe('annual')
  })
  it('ignores income', () => {
    expect(
      detectRecurring([
        t('salary', '2026-04-15', 3000),
        t('salary', '2026-05-15', 3000),
        t('salary', '2026-06-15', 3000),
      ]),
    ).toHaveLength(0)
  })
})
