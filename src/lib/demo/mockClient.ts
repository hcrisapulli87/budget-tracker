// A tiny in-memory stand-in for the Supabase client, used only by the demo
// build (VITE_DEMO=true). It answers the exact query surface Tally's data layer
// uses — from().select/insert/update/delete/upsert with eq/gt/gte/lt/lte/in/
// ilike/order/limit/single — plus a fake always-signed-in auth session and
// no-op realtime/storage. No network, no login.
import { buildStore, ME_ID } from './mockData'

type Row = Record<string, unknown>
const uid = () => crypto.randomUUID()

// Built lazily on first query so the normal (non-demo) build, which imports
// this module but never calls it, pays nothing at startup.
let _store: Record<string, Row[]> | null = null
const getStore = () => (_store ??= buildStore())

// realtime: mutations notify subscribers so the UI live-refreshes after edits
const listeners = new Map<string, Set<() => void>>()
function notify(table: string) {
  listeners.get(table)?.forEach((fn) => fn())
}

type Filter = { kind: string; col: string; val: unknown }

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    const v = row[f.col]
    switch (f.kind) {
      case 'eq':
        return v === f.val
      case 'neq':
        return v !== f.val
      case 'gt':
        return (v as number | string) > (f.val as number | string)
      case 'gte':
        return (v as number | string) >= (f.val as number | string)
      case 'lt':
        return (v as number | string) < (f.val as number | string)
      case 'lte':
        return (v as number | string) <= (f.val as number | string)
      case 'in':
        return (f.val as unknown[]).includes(v)
      case 'ilike': {
        const pat = String(f.val).replace(/%/g, '').toLowerCase()
        return String(v ?? '').toLowerCase().includes(pat)
      }
      default:
        return true
    }
  })
}

class QueryBuilder implements PromiseLike<{ data: unknown; error: null }> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private filters: Filter[] = []
  private orders: { col: string; asc: boolean }[] = []
  private limitN: number | null = null
  private _single = false
  private maybe = false
  private returning = false
  private payload: Row | Row[] | null = null
  private onConflict: string | null = null

  constructor(private table: string) {}

  private rows(): Row[] {
    const store = getStore(); if (!store[this.table]) store[this.table] = []
    return store[this.table]
  }

  select(_cols?: string) {
    if (this.op === 'insert' || this.op === 'upsert' || this.op === 'update') this.returning = true
    else this.op = 'select'
    return this
  }
  insert(payload: Row | Row[]) {
    this.op = 'insert'
    this.payload = payload
    return this
  }
  update(payload: Row) {
    this.op = 'update'
    this.payload = payload
    return this
  }
  upsert(payload: Row, opts?: { onConflict?: string }) {
    this.op = 'upsert'
    this.payload = payload
    this.onConflict = opts?.onConflict ?? null
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }

  eq(col: string, val: unknown) {
    this.filters.push({ kind: 'eq', col, val })
    return this
  }
  neq(col: string, val: unknown) {
    this.filters.push({ kind: 'neq', col, val })
    return this
  }
  gt(col: string, val: unknown) {
    this.filters.push({ kind: 'gt', col, val })
    return this
  }
  gte(col: string, val: unknown) {
    this.filters.push({ kind: 'gte', col, val })
    return this
  }
  lt(col: string, val: unknown) {
    this.filters.push({ kind: 'lt', col, val })
    return this
  }
  lte(col: string, val: unknown) {
    this.filters.push({ kind: 'lte', col, val })
    return this
  }
  in(col: string, val: unknown[]) {
    this.filters.push({ kind: 'in', col, val })
    return this
  }
  ilike(col: string, val: string) {
    this.filters.push({ kind: 'ilike', col, val })
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending ?? true })
    return this
  }
  limit(n: number) {
    this.limitN = n
    return this
  }
  maybeSingle() {
    this.maybe = true
    this._single = true
    return this
  }
  single() {
    this._single = true
    return this
  }

  private applyReadShape(rows: Row[]): unknown {
    let out = rows.filter((r) => matches(r, this.filters))
    for (let i = this.orders.length - 1; i >= 0; i--) {
      const { col, asc } = this.orders[i]
      out = [...out].sort((a, b) => {
        const av = a[col] as number | string
        const bv = b[col] as number | string
        if (av === bv) return 0
        return (av < bv ? -1 : 1) * (asc ? 1 : -1)
      })
    }
    if (this.limitN != null) out = out.slice(0, this.limitN)
    if (this._single || this.maybe) return out[0] ?? null
    return out
  }

  private run(): { data: unknown; error: null } {
    const rows = this.rows()
    switch (this.op) {
      case 'select':
        return { data: this.applyReadShape(rows), error: null }
      case 'insert': {
        const items = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[]
        const inserted = items.map((r) => ({ id: uid(), ...r }))
        rows.push(...inserted)
        notify(this.table)
        if (this.returning) return { data: this._single ? inserted[0] : inserted, error: null }
        return { data: null, error: null }
      }
      case 'upsert': {
        const item = this.payload as Row
        const key = this.onConflict?.split(',').map((s) => s.trim()) ?? ['id']
        const existing = rows.find((r) => key.every((k) => r[k] === item[k]))
        if (existing) Object.assign(existing, item)
        else rows.push({ id: uid(), ...item })
        notify(this.table)
        return { data: null, error: null }
      }
      case 'update': {
        const patch = this.payload as Row
        const hits = rows.filter((r) => matches(r, this.filters))
        hits.forEach((r) => Object.assign(r, patch))
        notify(this.table)
        return { data: hits, error: null }
      }
      case 'delete': {
        const keep = rows.filter((r) => !matches(r, this.filters))
        getStore()[this.table] = keep
        notify(this.table)
        return { data: null, error: null }
      }
    }
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected)
    } catch (e) {
      return Promise.reject(e).then(onfulfilled, onrejected) as PromiseLike<TResult2>
    }
  }
}

// ── fake auth: always signed in as ME, no login screen ─────────────────────────
const fakeUser = {
  id: ME_ID,
  email: 'demo@tally.app',
  app_metadata: {},
  user_metadata: { name: 'Alex' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
}
const fakeSession = {
  access_token: 'demo-token',
  refresh_token: 'demo-refresh',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: fakeUser,
}

const auth = {
  getSession: async () => ({ data: { session: fakeSession }, error: null }),
  getUser: async () => ({ data: { user: fakeUser }, error: null }),
  onAuthStateChange: (_cb: unknown) => ({
    data: { subscription: { unsubscribe() {} } },
  }),
  signInWithPassword: async () => ({ data: { session: fakeSession, user: fakeUser }, error: null }),
  signOut: async () => ({ error: null }),
}

// ── no-op storage (tax docs are seeded straight into the table) ────────────────
const storage = {
  from: (_bucket: string) => ({
    upload: async () => ({ data: { path: 'demo' }, error: null }),
    remove: async () => ({ data: [], error: null }),
    createSignedUrl: async () => ({ data: { signedUrl: '#' }, error: null }),
  }),
}

// ── no-op realtime channel wired to the in-memory notify() bus ─────────────────
function channel(_name: string) {
  const tables = new Set<string>()
  const cb = { current: () => {} }
  const ch = {
    on(_event: string, filter: { table?: string }, handler: () => void) {
      if (filter.table) tables.add(filter.table)
      cb.current = handler
      return ch
    },
    subscribe() {
      tables.forEach((t) => {
        if (!listeners.has(t)) listeners.set(t, new Set())
        listeners.get(t)!.add(cb.current)
      })
      return ch
    },
    _teardown() {
      tables.forEach((t) => listeners.get(t)?.delete(cb.current))
    },
  }
  return ch
}

export const mockSupabase = {
  from: (table: string) => new QueryBuilder(table),
  auth,
  storage,
  channel,
  removeChannel: (ch: { _teardown?: () => void }) => {
    ch._teardown?.()
    return Promise.resolve('ok')
  },
}
