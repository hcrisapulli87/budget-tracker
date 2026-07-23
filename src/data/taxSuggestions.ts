import { supabase } from '../lib/supabase'
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

/** FY spend transactions not yet marked deductible that match a known AU deduction keyword. */
export async function fetchDeductionCandidates(fy: number): Promise<DeductionCandidate[]> {
  const { start, end } = fyDateRange(fy)
  const { data, error } = await supabase
    .from('budget_transactions')
    .select('*')
    .eq('deductible', false)
    .lt('amount', 0)
    .gte('txn_date', start)
    .lte('txn_date', end)
    .order('txn_date', { ascending: false })
  if (error) throw error
  const candidates: DeductionCandidate[] = []
  for (const txn of (data ?? []) as Txn[]) {
    const norm = txn.merchant_norm || normaliseMerchant(txn.description)
    const suggestedCategory = suggestDeductionCategory(norm)
    if (suggestedCategory) candidates.push({ txn, suggestedCategory })
  }
  return candidates
}

/**
 * FY money-in transactions, classified by likely source, excluding any already
 * pulled into tax_income (matched by a "txn:<id>" marker we stash in the note).
 */
export async function fetchIncomeCandidates(fy: number): Promise<IncomeCandidate[]> {
  const { start, end } = fyDateRange(fy)
  const [txnsRes, incomeRes] = await Promise.all([
    supabase
      .from('budget_transactions')
      .select('*')
      .gt('amount', 0)
      .gte('txn_date', start)
      .lte('txn_date', end)
      .order('txn_date', { ascending: false }),
    supabase.from('tax_income').select('note').eq('fy', fy),
  ])
  if (txnsRes.error) throw txnsRes.error
  if (incomeRes.error) throw incomeRes.error
  const imported = new Set(
    (incomeRes.data ?? [])
      .map((r) => /txn:([0-9a-f-]+)/.exec((r as { note: string }).note ?? '')?.[1])
      .filter((id): id is string => Boolean(id)),
  )
  return ((txnsRes.data ?? []) as Txn[])
    .filter((txn) => !imported.has(txn.id))
    .map((txn) => ({ txn, suggestedSource: classifyIncome(txn.merchant_norm || normaliseMerchant(txn.description)) }))
}

/** Marker stashed in a tax_income row's note so a re-scan doesn't re-suggest it. */
export function importedFromTxnNote(txnId: string): string {
  return `txn:${txnId}`
}
