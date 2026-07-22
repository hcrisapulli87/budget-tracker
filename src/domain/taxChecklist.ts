/** Generic AU EOFY checklist — reminders, not personalised advice. */
export interface ChecklistItem {
  key: string
  label: string
}

export const TAX_CHECKLIST: ChecklistItem[] = [
  { key: 'income_statements', label: 'Income statements collected (from myGov or employer)' },
  { key: 'wfh_method', label: 'Work-from-home hours/method noted' },
  { key: 'work_expense_receipts', label: 'Work-related expense receipts filed' },
  { key: 'donation_receipts', label: 'Donation receipts kept ($2+)' },
  { key: 'private_health', label: 'Private health insurance statement on hand' },
  { key: 'investment_statements', label: 'Investment / dividend statements collected' },
  { key: 'prior_year_return', label: 'Prior-year return available for reference' },
]
