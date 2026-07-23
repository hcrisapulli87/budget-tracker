export interface Profile {
  id: string
  display_name: string
}

export interface Category {
  id: string
  name: string
  colour: string
  icon: string
  sort_order: number
  is_archived: boolean
  exclude_from_analytics: boolean
}

export type RuleOrigin = 'seed' | 'correction'

export interface Rule {
  id: string
  pattern: string
  category_id: string
  hits: number
  created_from: RuleOrigin
}

export type TxnSource = 'csv' | 'manual'

export interface Txn {
  id: string
  owner_id: string
  account: string
  txn_date: string
  amount: number
  description: string
  merchant_norm: string
  category_id: string | null
  category_confirmed: boolean
  import_hash: string
  source: TxnSource
  import_id: string | null
  note: string
  deductible: boolean
  deduction_category: string | null
}

export type Cadence = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual'
export type SubStatus = 'candidate' | 'confirmed' | 'dismissed' | 'cancelled'

export interface Subscription {
  id: string
  owner_id: string
  merchant_norm: string
  name: string
  cadence: Cadence
  amount: number
  price_history: { date: string; amount: number }[]
  next_expected: string | null
  status: SubStatus
}

export interface Account {
  id: string
  name: string
  owner_id: string | null
  balance: number | null
  balance_as_of: string | null
  sort_order: number
  is_archived: boolean
  goal_amount: number | null
  bsb: string | null
  account_number: string | null
}

export type BillFrequency = 'monthly' | 'quarterly' | 'annual'

export interface Bill {
  id: string
  name: string
  amount: number
  is_estimate: boolean
  frequency: BillFrequency
  due_day: number
  next_due: string
  autopay: boolean
  category_id: string | null
  last_paid: string | null
}

export interface Budget {
  id: string
  category_id: string
  monthly_limit: number
}

export interface Settlement {
  id: string
  from_id: string
  to_id: string
  amount: number
  settled_at: string
  created_by: string
}

export interface ImportRecord {
  id: string
  owner_id: string
  account: string
  filename: string
  imported_at: string
  row_count: number
  new_count: number
  duplicate_count: number
}

export type IncomeSourceType = 'salary' | 'investment' | 'business' | 'other'

export interface TaxIncome {
  id: string
  owner_id: string
  fy: number
  source_type: IncomeSourceType
  payer: string
  amount: number
  date: string
  note: string
}

export type DeductionCategory = 'wfh' | 'vehicle' | 'self_education' | 'donations' | 'tools' | 'other'

export interface TaxDeduction {
  id: string
  owner_id: string
  fy: number
  category: DeductionCategory
  description: string
  amount: number
  date: string
  note: string
}

export type TaxDocType = 'receipt' | 'statement' | 'other'
export type TaxLinkType = 'income' | 'deduction' | 'none'

export interface TaxDocument {
  id: string
  owner_id: string
  fy: number
  title: string
  doc_type: TaxDocType
  storage_path: string
  link_type: TaxLinkType
  link_id: string | null
  amount: number | null
  date: string | null
}

export interface TaxChecklistState {
  id: string
  owner_id: string
  fy: number
  item_key: string
  done: boolean
}
