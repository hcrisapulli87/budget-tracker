import { supabase } from '../lib/supabase'
import { fetchAllRows } from './paging'
import { fyDateRange } from '../domain/fy'
import { suggestDeductionCategory } from '../domain/deductionRules'
import { classifyIncome } from '../domain/incomeSource'
import { normaliseMerchant } from '../domain/merchant'
import type { DeductionCategory, IncomeSourceType, Txn } from './types'

export interface DeductionCandidate {
  txn: Txn
  suggestedCategory: DeductionCategory
}

export interface IncomeCandidate {
  txn: Txn
  suggestedSource: IncomeSourceType
}

/** Your FY spend transactions not yet marked deductible that match a known AU deduction keyword. */
export async function fetchDeductionCandidates(fy: number, ownerId: string): Promise<DeductionCandidate[]> {
  const { start, end } = fyDateRange(fy)
  const data = await fetchAllRows<Txn>((from, to) =>
    supabase
      .from('budget_transactions')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('deductible', false)
      .lt('amount', 0)
      .gte('txn_date', start)
      .lte('txn_date', end)
      .order('txn_date', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
  )
  const candidates: DeductionCandidate[] = []
  for (const txn of data) {
    const norm = txn.merchant_norm || normaliseMerchant(txn.description)
    const suggestedCategory = suggestDeductionCategory(norm)
    if (suggestedCategory) candidates.push({ txn, suggestedCategory })
  }
  return candidates
}

/**
 * Your FY money-in transactions, classified by likely source, excluding any already
 * pulled into tax_income (matched by a "txn:<id>" marker we stash in the note).
 */
export async function fetchIncomeCandidates(fy: number, ownerId: string): Promise<IncomeCandidate[]> {
  const { start, end } = fyDateRange(fy)
  const [txns, incomeRes] = await Promise.all([
    fetchAllRows<Txn>((from, to) =>
      supabase
        .from('budget_transactions')
        .select('*')
        .eq('owner_id', ownerId)
        .gt('amount', 0)
        .gte('txn_date', start)
        .lte('txn_date', end)
        .order('txn_date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    ),
    supabase.from('tax_income').select('note').eq('fy', fy),
  ])
  if (incomeRes.error) throw incomeRes.error
  const imported = new Set(
    (incomeRes.data ?? [])
      .map((r) => /txn:([0-9a-f-]+)/.exec((r as { note: string }).note ?? '')?.[1])
      .filter((id): id is string => Boolean(id)),
  )
  return txns
    .filter((txn) => !imported.has(txn.id))
    .map((txn) => ({ txn, suggestedSource: classifyIncome(txn.merchant_norm || normaliseMerchant(txn.description)) }))
}

/** Marker stashed in a tax_income row's note so a re-scan doesn't re-suggest it. */
export function importedFromTxnNote(txnId: string): string {
  return `txn:${txnId}`
}
