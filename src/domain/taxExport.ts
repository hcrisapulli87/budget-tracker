import { fyLabel } from './fy'
import { deductionLabel } from './deductionCategories'
import type { TaxDeduction, TaxDocument, TaxIncome, Txn } from '../data/types'

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(',')
}

export function buildTaxSummaryCsv(
  fy: number,
  income: TaxIncome[],
  manualDeductions: TaxDeduction[],
  taggedDeductions: Txn[],
  documents: TaxDocument[],
): string {
  const lines: string[] = []
  lines.push(`Tally tax summary — ${fyLabel(fy)}`)
  lines.push('')

  lines.push('Income')
  lines.push(csvRow(['Date', 'Source', 'Payer', 'Amount']))
  for (const i of income) lines.push(csvRow([i.date, i.source_type, i.payer, i.amount]))
  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  lines.push(csvRow(['', '', 'Total', totalIncome]))
  lines.push('')

  lines.push('Deductions')
  lines.push(csvRow(['Date', 'Category', 'Description', 'Amount', 'Source']))
  for (const d of manualDeductions) lines.push(csvRow([d.date, deductionLabel(d.category), d.description, d.amount, 'manual']))
  for (const t of taggedDeductions) {
    lines.push(csvRow([t.txn_date, t.deduction_category ? deductionLabel(t.deduction_category) : '', t.description, Math.abs(t.amount), 'Tally activity']))
  }
  const totalDeductions =
    manualDeductions.reduce((s, d) => s + d.amount, 0) + taggedDeductions.reduce((s, t) => s + Math.abs(t.amount), 0)
  lines.push(csvRow(['', '', '', totalDeductions, '']))
  lines.push('')

  lines.push(csvRow(['Net (income − deductions)', totalIncome - totalDeductions]))
  lines.push('')

  lines.push('Documents on file')
  for (const d of documents) lines.push(csvRow([d.date ?? '', d.doc_type, d.title]))

  return lines.join('\n')
}

export function downloadTaxSummary(fy: number, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tally-tax-${fyLabel(fy).replace('–', '-')}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
