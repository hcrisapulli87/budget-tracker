import { describe, expect, it } from 'vitest'
import { importKey, assignKeys } from './importKey'

describe('importKey', () => {
  it('is stable across case and spacing noise', () => {
    expect(importKey('Everyday', '2026-06-23', -12.5, ' WOOLWORTHS  SYDNEY ')).toBe(
      importKey('everyday', '2026-06-23', -12.5, 'Woolworths Sydney'),
    )
  })
  it('differs when any component differs', () => {
    expect(importKey('a', '2026-06-23', -12.5, 'x')).not.toBe(importKey('a', '2026-06-24', -12.5, 'x'))
  })
})

describe('assignKeys', () => {
  const txn = { dateIso: '2026-06-23', amount: -4.5, description: 'COFFEE' }
  it('suffixes identical rows within one batch', () => {
    const keyed = assignKeys([txn, { ...txn }, { ...txn }], 'everyday')
    expect(keyed[0].key).not.toBe(keyed[1].key)
    expect(keyed[1].key.endsWith('#2')).toBe(true)
    expect(keyed[2].key.endsWith('#3')).toBe(true)
  })
  it('reproduces the same keys for the same batch (re-import dedupes)', () => {
    const a = assignKeys([txn, { ...txn }], 'everyday').map((k) => k.key)
    const b = assignKeys([txn, { ...txn }], 'everyday').map((k) => k.key)
    expect(a).toEqual(b)
  })
})
