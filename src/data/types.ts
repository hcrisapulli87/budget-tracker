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
  /** null = household default (seeds + pre-v7 corrections); yours beats it */
  owner_id: string | null
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
  /** null = not split. Each part is signed like `amount`; parts sum to it. */
  splits?: TxnSplit[] | null
  /** A cost both people owe half of — counts towards settle-up. */
  shared?: boolean
}

export interface TxnSplit {
  category_id: string | null
  amount: number
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
  kind?: AccountKind
}

export type AccountKind = 'bank' | 'savings' | 'credit' | 'super' | 'investment' | 'property' | 'loan' | 'other'

export interface BalancePoint {
  id: string
  account_id: string
  as_of: string
  balance: number
}

export type BillFrequency = 'monthly' | 'quarterly' | 'annual'

export interface Bill {
  id: string
  /** null = joint bill, shown in both people's views */
  owner_id: string | null
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
  owner_id: string
  category_id: string
  monthly_limit: number
  rollover?: boolean
  /** First month (yyyy-mm-01) the rollover counts from. */
  rollover_from?: string | null
}

export interface Goal {
  id: string
  /** null = Joint goal, shown to and fundable by both people */
  owner_id: string | null
  name: string
  icon: string
  target_amount: number
  target_date: string | null
  saved_amount: number
  is_archived: boolean
  created_at: string
}

export interface Comment {
  id: string
  txn_id: string
  author_id: string
  body: string
  created_at: string
}

export interface Settlement {
  id: string
  /** who paid the difference */
  from_id: string
  /** who was owed it */
  to_id: string
  amount: number
  settled_at: string
  created_by: string
}

export type PayCadence = 'weekly' | 'fortnightly' | 'monthly'

export interface ForecastSettings {
  owner_id: string
  pay_cadence: PayCadence | null
  pay_amount: number | null
  next_payday: string | null
  buffer: number
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
export type TaxLinkType = 'income' | 'deduction' | 'transaction' | 'none'

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
