import { describe, it, expect } from 'vitest'
import { packFileNames, receiptGaps } from './taxExport'
import type { TaxDocument, Txn } from '../data/types'

const txn = (id: string, amount: number) => ({ id, amount }) as Txn
const doc = (over: Partial<TaxDocument>): TaxDocument => ({
  id: 'd', owner_id: 'me', fy: 2026, title: 'r', doc_type: 'receipt', storage_path: 'p', link_type: 'none', link_id: null, amount: null, date: null, ...over,
})

describe('receiptGaps', () => {
  it('lists deductible transactions with no linked receipt, biggest first', () => {
    const gaps = receiptGaps([txn('a', -20), txn('b', -300), txn('c', -50)], [doc({ link_type: 'transaction', link_id: 'c' })])
    expect(gaps.map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('packFileNames', () => {
  it('makes safe, unique names that keep the extension', () => {
    expect(packFileNames([
      { title: 'Officeworks: desk/chair', date: '2026-03-01', storage_path: 'me/2026/x-desk.pdf' },
      { title: 'Officeworks: desk/chair', date: '2026-03-01', storage_path: 'me/2026/y-desk.pdf' },
      { title: 'Course.jpg', date: null, storage_path: 'me/2026/z-Course.jpg' },
    ])).toEqual([
      'receipts/2026-03-01 Officeworks- desk-chair.pdf',
      'receipts/2026-03-01 Officeworks- desk-chair (2).pdf',
      'receipts/undated Course.jpg',
    ])
  })
})
