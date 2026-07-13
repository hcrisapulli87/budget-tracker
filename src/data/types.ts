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
