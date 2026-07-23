// Random demo dataset for the login-free demo build. Every screen gets
// realistic, pre-filled data. Regenerated fresh on each page load — the point
// is a designer can open the app and see every section populated.
import { normaliseMerchant } from '../../domain/merchant'
import { auFinancialYear, currentFy } from '../../domain/fy'

const uid = () => crypto.randomUUID()

// ── people (the two profiles; the demo signs in as ME) ─────────────────────────
export const ME_ID = '11111111-1111-4111-8111-111111111111'
export const PARTNER_ID = '22222222-2222-4222-8222-222222222222'

// ── small random helpers ───────────────────────────────────────────────────────
const rand = (min: number, max: number) => min + Math.random() * (max - min)
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))
const pick = <T>(arr: T[]): T => arr[randInt(0, arr.length - 1)]
const chance = (p: number) => Math.random() < p
const money = (min: number, max: number) => Math.round(rand(min, max) * 100) / 100

const today = new Date()
const iso = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() - n)
  return iso(d)
}

// ── categories (mirror schema seed, with stable ids) ───────────────────────────
interface Cat {
  id: string
  name: string
  colour: string
  icon: string
  sort_order: number
  is_archived: boolean
  exclude_from_analytics: boolean
}
const CAT_DEFS: [string, string, string][] = [
  ['Groceries', '#2fbf71', '🛒'],
  ['Eating Out', '#f4a259', '🍽️'],
  ['Transport', '#5b8def', '🚌'],
  ['Fuel', '#8d6a9f', '⛽'],
  ['Utilities', '#4ecdc4', '💡'],
  ['Rent/Mortgage', '#e07a5f', '🏠'],
  ['Insurance', '#7f96ab', '🛡️'],
  ['Health', '#e6739f', '🩺'],
  ['Entertainment', '#c05dd1', '🎬'],
  ['Subscriptions', '#f25f5c', '🔁'],
  ['Shopping', '#ffb400', '🛍️'],
  ['Personal', '#70a37f', '💇'],
  ['Gifts', '#ef8fb0', '🎁'],
  ['Travel', '#3aa7d9', '✈️'],
  ['Income', '#1e9a58', '💰'],
  ['Other', '#9aa5b1', '📦'],
]
export const categories: Cat[] = CAT_DEFS.map(([name, colour, icon], i) => ({
  id: uid(),
  name,
  colour,
  icon,
  sort_order: i + 1,
  is_archived: false,
  exclude_from_analytics: false,
}))
categories.push({
  id: uid(),
  name: 'Transfers',
  colour: '#7f96ab',
  icon: '↔️',
  sort_order: 17,
  is_archived: false,
  exclude_from_analytics: true,
})
const catByName = (n: string) => categories.find((c) => c.name === n)!

// ── merchant pools per category (drives realistic descriptions + rules) ─────────
const MERCHANTS: Record<string, { name: string; min: number; max: number }[]> = {
  Groceries: [
    { name: 'WOOLWORTHS 3021', min: 25, max: 190 },
    { name: 'COLES SUPERMARKET', min: 20, max: 165 },
    { name: 'ALDI STORES', min: 15, max: 120 },
    { name: 'IGA LOCAL', min: 8, max: 70 },
  ],
  'Eating Out': [
    { name: 'UBER EATS', min: 22, max: 68 },
    { name: 'MCDONALDS', min: 9, max: 34 },
    { name: 'GUZMAN Y GOMEZ', min: 14, max: 42 },
    { name: 'DOORDASH', min: 20, max: 60 },
    { name: 'THE LOCAL CAFE', min: 6, max: 28 },
  ],
  Transport: [
    { name: 'OPAL TRAVEL', min: 4, max: 44 },
    { name: 'UBER TRIP', min: 12, max: 55 },
    { name: 'LINKT TOLLS', min: 8, max: 36 },
  ],
  Fuel: [
    { name: 'BP CONNECT', min: 45, max: 120 },
    { name: 'SHELL COLES EXPRESS', min: 50, max: 130 },
    { name: 'AMPOL', min: 40, max: 115 },
    { name: '7-ELEVEN 4402', min: 35, max: 95 },
  ],
  Utilities: [
    { name: 'AGL ENERGY', min: 90, max: 320 },
    { name: 'TELSTRA', min: 55, max: 99 },
    { name: 'AUSSIE BROADBAND', min: 79, max: 99 },
  ],
  Health: [
    { name: 'CHEMIST WAREHOUSE', min: 12, max: 88 },
    { name: 'PRICELINE PHARMACY', min: 9, max: 60 },
    { name: 'MY GP CLINIC', min: 40, max: 95 },
  ],
  Entertainment: [
    { name: 'HOYTS CINEMAS', min: 22, max: 58 },
    { name: 'TICKETEK', min: 45, max: 220 },
    { name: 'STEAM GAMES', min: 15, max: 90 },
  ],
  Shopping: [
    { name: 'KMART', min: 12, max: 140 },
    { name: 'JB HI-FI', min: 25, max: 380 },
    { name: 'BUNNINGS WAREHOUSE', min: 18, max: 160 },
    { name: 'AMAZON AU', min: 15, max: 130 },
    { name: 'BIG W', min: 14, max: 110 },
  ],
  Personal: [
    { name: 'THE BARBER CO', min: 25, max: 55 },
    { name: 'ANYTIME FITNESS', min: 22, max: 22 },
    { name: 'MECCA COSMETICA', min: 30, max: 120 },
  ],
  Gifts: [
    { name: 'TYPO', min: 10, max: 60 },
    { name: 'FLOWERS BY LILY', min: 45, max: 120 },
  ],
  Travel: [
    { name: 'JETSTAR AIRWAYS', min: 89, max: 420 },
    { name: 'AIRBNB', min: 140, max: 560 },
    { name: 'QANTAS', min: 120, max: 680 },
  ],
}

// ── accounts ────────────────────────────────────────────────────────────────────
interface Account {
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
const bsb = () => `${randInt(10, 99)}${randInt(1000, 9999)}`.replace(/(\d{3})(\d{3})/, '$1-$2')
const acctNo = () => String(randInt(10000000, 99999999))
export const accounts: Account[] = [
  { name: 'Everyday Spending', owner_id: ME_ID, balance: money(1200, 4200), goal_amount: null },
  { name: 'Emergency Savings', owner_id: ME_ID, balance: money(8000, 22000), goal_amount: 30000 },
  { name: 'Sam Everyday', owner_id: PARTNER_ID, balance: money(900, 3800), goal_amount: null },
  { name: 'Holiday Fund', owner_id: PARTNER_ID, balance: money(1500, 9000), goal_amount: 12000 },
  { name: 'Joint Bills', owner_id: null, balance: money(600, 3200), goal_amount: null },
].map((a, i) => ({
  id: uid(),
  name: a.name,
  owner_id: a.owner_id,
  balance: a.balance,
  balance_as_of: daysAgo(randInt(0, 6)),
  sort_order: i,
  is_archived: false,
  goal_amount: a.goal_amount,
  bsb: bsb(),
  account_number: acctNo(),
}))
const acctFor = (owner: string) => pick(accounts.filter((a) => a.owner_id === owner || a.owner_id === null)).name

// ── transactions ────────────────────────────────────────────────────────────────
interface Txn {
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
  source: 'csv' | 'manual'
  import_id: string | null
  note: string
  deductible: boolean
  deduction_category: string | null
}
export const transactions: Txn[] = []
const spendCats = Object.keys(MERCHANTS)
let hashN = 0

function addSpend(owner: string, dayOffset: number) {
  const catName = pick(spendCats)
  const m = pick(MERCHANTS[catName])
  const cat = catByName(catName)
  const desc = `${m.name} ${chance(0.4) ? `AU ${randInt(1000, 9999)}` : ''}`.trim()
  const confirmed = chance(0.82)
  // occasional deductible work expense on plausible categories
  const deductible = chance(0.12) && ['Shopping', 'Health', 'Travel', 'Transport'].includes(catName)
  transactions.push({
    id: uid(),
    owner_id: owner,
    account: acctFor(owner),
    txn_date: daysAgo(dayOffset),
    amount: -money(m.min, m.max),
    description: desc,
    merchant_norm: normaliseMerchant(desc),
    category_id: confirmed ? cat.id : chance(0.5) ? cat.id : null,
    category_confirmed: confirmed,
    import_hash: `demo-${hashN++}`,
    source: chance(0.15) ? 'manual' : 'csv',
    import_id: null,
    note: chance(0.1) ? pick(['split with Sam', 'reimburse later', 'work trip', 'gift for mum']) : '',
    deductible,
    deduction_category: deductible ? pick(['tools', 'self_education', 'vehicle', 'other']) : null,
  })
}

// dense recent history (last ~5 months) so the dashboard's rolling windows fill
for (let d = 0; d < 150; d++) {
  const perDay = randInt(0, 3)
  for (let k = 0; k < perDay; k++) addSpend(chance(0.62) ? ME_ID : PARTNER_ID, d)
}
// lighter older tail (up to ~15 months) for insights + recurrence detection
for (let d = 150; d < 460; d++) {
  if (chance(0.5)) addSpend(chance(0.62) ? ME_ID : PARTNER_ID, d)
}

// fortnightly salary for both people (positive = money in)
const incomeCat = catByName('Income')
for (let d = 460; d >= 0; d -= 14) {
  for (const [owner, payer, amt] of [
    [ME_ID, 'ACME PAYROLL SALARY', money(2600, 3100)],
    [PARTNER_ID, 'GLOBEX PTY LTD PAYROLL', money(2300, 2800)],
  ] as [string, string, number][]) {
    transactions.push({
      id: uid(),
      owner_id: owner,
      account: acctFor(owner),
      txn_date: daysAgo(d),
      amount: Math.round(amt * 100) / 100,
      description: payer,
      merchant_norm: normaliseMerchant(payer),
      category_id: incomeCat.id,
      category_confirmed: true,
      import_hash: `demo-${hashN++}`,
      source: 'csv',
      import_id: null,
      note: '',
      deductible: false,
      deduction_category: null,
    })
  }
}

// recurring subscription-style charges (monthly) — feeds Recurring + detection
const RECURRING = [
  { name: 'NETFLIX.COM', amount: 22.99, cadence: 'monthly' as const },
  { name: 'SPOTIFY AU', amount: 13.99, cadence: 'monthly' as const },
  { name: 'DISNEY PLUS', amount: 15.99, cadence: 'monthly' as const },
  { name: 'ANYTIME FITNESS', amount: 21.95, cadence: 'fortnightly' as const },
  { name: 'AMAZON PRIME', amount: 9.99, cadence: 'monthly' as const },
  { name: 'ADOBE CREATIVE', amount: 21.99, cadence: 'monthly' as const },
]
const subsCat = catByName('Subscriptions')
for (const r of RECURRING) {
  const step = r.cadence === 'fortnightly' ? 14 : 30
  for (let d = randInt(0, step); d < 460; d += step) {
    transactions.push({
      id: uid(),
      owner_id: ME_ID,
      account: acctFor(ME_ID),
      txn_date: daysAgo(d),
      amount: -r.amount,
      description: r.name,
      merchant_norm: normaliseMerchant(r.name),
      category_id: subsCat.id,
      category_confirmed: true,
      import_hash: `demo-${hashN++}`,
      source: 'csv',
      import_id: null,
      note: '',
      deductible: false,
      deduction_category: null,
    })
  }
}

// ── subscriptions (detected recurring) ──────────────────────────────────────────
interface Subscription {
  id: string
  owner_id: string
  merchant_norm: string
  name: string
  cadence: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual'
  amount: number
  price_history: { date: string; amount: number }[]
  next_expected: string | null
  status: 'candidate' | 'confirmed' | 'dismissed' | 'cancelled'
}
export const subscriptions: Subscription[] = RECURRING.map((r, i) => {
  const raised = chance(0.5)
  const history = raised
    ? [
        { date: daysAgo(200), amount: Math.round(r.amount * 0.85 * 100) / 100 },
        { date: daysAgo(30), amount: r.amount },
      ]
    : [{ date: daysAgo(30), amount: r.amount }]
  return {
    id: uid(),
    owner_id: ME_ID,
    merchant_norm: normaliseMerchant(r.name),
    name: r.name.replace(/\.COM| AU| PLUS/g, (s) => (s === ' PLUS' ? '+' : '')).trim(),
    cadence: r.cadence,
    amount: r.amount,
    price_history: history,
    next_expected: daysAgo(-randInt(2, 25)),
    status: i < 4 ? 'confirmed' : (['candidate', 'candidate', 'dismissed'] as const)[i - 4] ?? 'candidate',
  }
})

// ── bills ────────────────────────────────────────────────────────────────────────
interface Bill {
  id: string
  name: string
  amount: number
  is_estimate: boolean
  frequency: 'monthly' | 'quarterly' | 'annual'
  due_day: number
  next_due: string
  autopay: boolean
  category_id: string | null
  last_paid: string | null
}
const nextDue = (dueDay: number) => {
  const d = new Date(today)
  d.setDate(dueDay)
  if (d < today) d.setMonth(d.getMonth() + 1)
  return iso(d)
}
export const bills: Bill[] = [
  { name: 'Rent', amount: 2400, freq: 'monthly' as const, cat: 'Rent/Mortgage', auto: true, est: false },
  { name: 'Electricity', amount: 285, freq: 'quarterly' as const, cat: 'Utilities', auto: false, est: true },
  { name: 'Water', amount: 190, freq: 'quarterly' as const, cat: 'Utilities', auto: false, est: true },
  { name: 'Car Insurance', amount: 1180, freq: 'annual' as const, cat: 'Insurance', auto: true, est: false },
  { name: 'Home Internet', amount: 89, freq: 'monthly' as const, cat: 'Utilities', auto: true, est: false },
  { name: 'Mobile Phone', amount: 55, freq: 'monthly' as const, cat: 'Utilities', auto: true, est: false },
  { name: 'Health Insurance', amount: 210, freq: 'monthly' as const, cat: 'Insurance', auto: true, est: false },
].map((b) => {
  const dueDay = randInt(1, 28)
  return {
    id: uid(),
    name: b.name,
    amount: b.amount,
    is_estimate: b.est,
    frequency: b.freq,
    due_day: dueDay,
    next_due: nextDue(dueDay),
    autopay: b.auto,
    category_id: catByName(b.cat)?.id ?? null,
    last_paid: chance(0.7) ? daysAgo(randInt(20, 40)) : null,
  }
})

// ── budgets (per-category monthly limits) ──────────────────────────────────────
interface Budget {
  id: string
  category_id: string
  monthly_limit: number
}
export const budgets: Budget[] = [
  ['Groceries', 900],
  ['Eating Out', 350],
  ['Fuel', 260],
  ['Shopping', 400],
  ['Entertainment', 200],
  ['Transport', 150],
  ['Subscriptions', 120],
  ['Health', 180],
].map(([name, limit]) => ({ id: uid(), category_id: catByName(name as string).id, monthly_limit: limit as number }))

// ── rules (seed learning rules) ────────────────────────────────────────────────
interface Rule {
  id: string
  pattern: string
  category_id: string
  hits: number
  created_from: 'seed' | 'correction'
}
const RULE_DEFS: [string, string][] = [
  ['woolworths', 'Groceries'],
  ['coles', 'Groceries'],
  ['aldi', 'Groceries'],
  ['uber eats', 'Eating Out'],
  ['mcdonald', 'Eating Out'],
  ['doordash', 'Eating Out'],
  ['bp connect', 'Fuel'],
  ['shell coles express', 'Fuel'],
  ['ampol', 'Fuel'],
  ['opal travel', 'Transport'],
  ['uber trip', 'Transport'],
  ['netflix', 'Subscriptions'],
  ['spotify', 'Subscriptions'],
  ['disney plus', 'Subscriptions'],
  ['agl energy', 'Utilities'],
  ['telstra', 'Utilities'],
  ['chemist warehouse', 'Health'],
  ['jb hi fi', 'Shopping'],
  ['bunnings warehouse', 'Shopping'],
  ['kmart', 'Shopping'],
]
export const rules: Rule[] = RULE_DEFS.map(([pattern, cat]) => ({
  id: uid(),
  pattern,
  category_id: catByName(cat).id,
  hits: randInt(2, 40),
  created_from: chance(0.75) ? 'seed' : 'correction',
}))

// ── imports (statement import history) ─────────────────────────────────────────
interface ImportRecord {
  id: string
  owner_id: string
  account: string
  filename: string
  imported_at: string
  row_count: number
  new_count: number
  duplicate_count: number
}
export const imports: ImportRecord[] = Array.from({ length: 5 }).map((_, i) => {
  const rows = randInt(40, 180)
  const dup = randInt(0, 15)
  return {
    id: uid(),
    owner_id: chance(0.6) ? ME_ID : PARTNER_ID,
    account: pick(accounts).name,
    filename: pick(['transactions', 'export', 'statement', 'account-history']) + `-${randInt(1, 12)}.csv`,
    imported_at: new Date(Date.now() - i * 86400000 * randInt(3, 20)).toISOString(),
    row_count: rows,
    new_count: rows - dup,
    duplicate_count: dup,
  }
})

// ── tax module (current + previous FY) ─────────────────────────────────────────
const FY = currentFy()
const PREV_FY = FY - 1
const fyDate = (fy: number) => {
  // a date inside the given AU FY (Jul fy-1 → Jun fy)
  const d = new Date(fy - 1, 6 + randInt(0, 11), randInt(1, 28))
  return iso(d)
}
void auFinancialYear // (imported for parity with app date logic)

interface TaxIncome {
  id: string
  owner_id: string
  fy: number
  source_type: 'salary' | 'investment' | 'business' | 'other'
  payer: string
  amount: number
  date: string
  note: string
}
export const taxIncome: TaxIncome[] = [FY, PREV_FY].flatMap((fy) => [
  { source_type: 'salary' as const, payer: 'Acme Pty Ltd', amount: money(78000, 96000) },
  { source_type: 'investment' as const, payer: 'CommSec Dividends', amount: money(400, 2200) },
  { source_type: 'investment' as const, payer: 'ING Savings Interest', amount: money(120, 900) },
  { source_type: 'business' as const, payer: 'Freelance Design', amount: money(1500, 6000) },
].map((r) => ({
  id: uid(),
  owner_id: ME_ID,
  fy,
  source_type: r.source_type,
  payer: r.payer,
  amount: Math.round(r.amount * 100) / 100,
  date: fyDate(fy),
  note: '',
})))

interface TaxDeduction {
  id: string
  owner_id: string
  fy: number
  category: 'wfh' | 'vehicle' | 'self_education' | 'donations' | 'tools' | 'other'
  description: string
  amount: number
  date: string
  note: string
}
export const taxDeductions: TaxDeduction[] = [FY, PREV_FY].flatMap((fy) => [
  { category: 'wfh' as const, description: 'Home office running costs', amount: money(320, 900) },
  { category: 'self_education' as const, description: 'Online course — UX certification', amount: money(180, 1200) },
  { category: 'tools' as const, description: 'External monitor + keyboard', amount: money(150, 700) },
  { category: 'donations' as const, description: 'Red Cross donation', amount: money(40, 300) },
  { category: 'vehicle' as const, description: 'Work travel — logbook km', amount: money(200, 950) },
].map((r) => ({
  id: uid(),
  owner_id: ME_ID,
  fy,
  category: r.category,
  description: r.description,
  amount: Math.round(r.amount * 100) / 100,
  date: fyDate(fy),
  note: '',
})))

interface TaxDocument {
  id: string
  owner_id: string
  fy: number
  title: string
  doc_type: 'receipt' | 'statement' | 'other'
  storage_path: string
  link_type: 'income' | 'deduction' | 'none'
  link_id: string | null
  amount: number | null
  date: string | null
}
export const taxDocuments: TaxDocument[] = [FY, PREV_FY].flatMap((fy) =>
  [
    { title: 'PAYG Payment Summary', doc_type: 'statement' as const },
    { title: 'Monitor receipt', doc_type: 'receipt' as const },
    { title: 'Course invoice', doc_type: 'receipt' as const },
    { title: 'Donation receipt', doc_type: 'receipt' as const },
  ].map((r) => ({
    id: uid(),
    owner_id: ME_ID,
    fy,
    title: r.title,
    doc_type: r.doc_type,
    storage_path: `${ME_ID}/${fy}/${uid()}-${r.title.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    link_type: 'none' as const,
    link_id: null,
    amount: chance(0.6) ? money(50, 900) : null,
    date: fyDate(fy),
  })),
)

interface TaxChecklistState {
  id: string
  owner_id: string
  fy: number
  item_key: string
  done: boolean
}
const CHECK_KEYS = ['income_statement', 'bank_interest', 'dividends', 'deductions_gathered', 'private_health', 'donations']
export const taxChecklist: TaxChecklistState[] = CHECK_KEYS.map((key) => ({
  id: uid(),
  owner_id: ME_ID,
  fy: FY,
  item_key: key,
  done: chance(0.5),
}))

// ── the seeded store, keyed by table name (matches schema tables) ──────────────
export function buildStore(): Record<string, Record<string, unknown>[]> {
  return {
    profiles: [
      { id: ME_ID, display_name: 'Alex' },
      { id: PARTNER_ID, display_name: 'Sam' },
    ],
    budget_categories: categories as unknown as Record<string, unknown>[],
    budget_rules: rules as unknown as Record<string, unknown>[],
    budget_accounts: accounts as unknown as Record<string, unknown>[],
    budget_transactions: transactions as unknown as Record<string, unknown>[],
    budget_subscriptions: subscriptions as unknown as Record<string, unknown>[],
    budget_bills: bills as unknown as Record<string, unknown>[],
    budget_budgets: budgets as unknown as Record<string, unknown>[],
    budget_imports: imports as unknown as Record<string, unknown>[],
    tax_income: taxIncome as unknown as Record<string, unknown>[],
    tax_deductions: taxDeductions as unknown as Record<string, unknown>[],
    tax_documents: taxDocuments as unknown as Record<string, unknown>[],
    tax_checklist_state: taxChecklist as unknown as Record<string, unknown>[],
  }
}
