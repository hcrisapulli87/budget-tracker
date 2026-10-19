// Tally push — daily Web Push alerts. Runs with the service role, so it can
// read every Tally user's data; it only ever sends a person their own alerts.
//
// Deploy:   supabase functions deploy tally-push --no-verify-jwt
// Secrets:  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com PUSH_CRON_SECRET=<random>
// Schedule: see README ("Push notifications") — pg_cron calls it daily with
//           the header  x-cron-secret: <PUSH_CRON_SECRET>.
//
// Alerts (each sent once, tracked in budget_push_log):
//   bills    a bill (yours or Joint) due within 3 days
//   budgets  a budget passing 90%, then going over, this month
//   subs     a newly spotted subscription, or a price rise
import { createClient } from 'npm:@supabase/supabase-js@2.108.2'
import webpush from 'npm:web-push@3.6.7'

const DAY = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)
const aud = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)

interface Alert { key: string; title: string; body: string; url: string; kind: 'bills' | 'budgets' | 'subs' }
interface PushSub { id: string; owner_id: string; endpoint: string; p256dh: string; auth: string; prefs: Record<string, boolean> }

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('forbidden', { status: 403 })

  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:tally@example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // "today" in Melbourne, matching the Discord bill reminders
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
  const month = today.slice(0, 7)
  const soon = iso(new Date(Date.parse(today) + 3 * DAY))

  const { data: subsRows, error: subsErr } = await db.from('budget_push_subscriptions').select('*')
  if (subsErr) return new Response(subsErr.message, { status: 500 })
  const subscriptions = (subsRows ?? []) as PushSub[]
  const owners = [...new Set(subscriptions.map((s) => s.owner_id))]

  const [{ data: bills }, { data: budgets }, { data: cats }, { data: detected }, { data: txns }, { data: log }] = await Promise.all([
    db.from('budget_bills').select('id, owner_id, name, amount, next_due').gte('next_due', today).lte('next_due', soon),
    db.from('budget_budgets').select('owner_id, category_id, monthly_limit').in('owner_id', owners),
    db.from('budget_categories').select('id, name'),
    db.from('budget_subscriptions').select('id, owner_id, name, amount, status, price_history').in('owner_id', owners).in('status', ['candidate', 'confirmed']),
    db.from('budget_transactions').select('owner_id, category_id, amount, splits').in('owner_id', owners).gte('txn_date', `${month}-01`).lt('amount', 0).limit(20000),
    db.from('budget_push_log').select('owner_id, key').in('owner_id', owners),
  ])
  const sent = new Set((log ?? []).map((l) => `${l.owner_id}|${l.key}`))
  const catName = (id: string) => (cats ?? []).find((c) => c.id === id)?.name ?? 'A category'

  const alertsFor = (owner: string): Alert[] => {
    const out: Alert[] = []
    for (const b of bills ?? []) {
      if (b.owner_id !== owner && b.owner_id !== null) continue
      const days = Math.round((Date.parse(b.next_due) - Date.parse(today)) / DAY)
      out.push({ kind: 'bills', key: `bill:${b.id}:${b.next_due}`, title: `${b.name} due ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`, body: `${aud(b.amount)} on ${b.next_due}`, url: '/recurring' })
    }
    const spent = new Map<string, number>()
    for (const t of txns ?? []) {
      if (t.owner_id !== owner) continue
      const parts = Array.isArray(t.splits) && t.splits.length > 1 ? t.splits : [{ category_id: t.category_id, amount: t.amount }]
      for (const p of parts) if (p.category_id && p.amount < 0) spent.set(p.category_id, (spent.get(p.category_id) ?? 0) - p.amount)
    }
    for (const b of budgets ?? []) {
      if (b.owner_id !== owner || b.monthly_limit <= 0) continue
      const s = spent.get(b.category_id) ?? 0
      const name = catName(b.category_id)
      if (s > b.monthly_limit) out.push({ kind: 'budgets', key: `budget:${b.category_id}:${month}:over`, title: `${name} is over budget`, body: `${aud(s)} of ${aud(b.monthly_limit)} this month`, url: '/budgets' })
      else if (s >= b.monthly_limit * 0.9) out.push({ kind: 'budgets', key: `budget:${b.category_id}:${month}:90`, title: `${name} is at ${Math.round((s / b.monthly_limit) * 100)}%`, body: `${aud(b.monthly_limit - s)} left this month`, url: '/budgets' })
    }
    for (const s of detected ?? []) {
      if (s.owner_id !== owner) continue
      const h = (s.price_history ?? []) as { date: string; amount: number }[]
      if (s.status === 'candidate') out.push({ kind: 'subs', key: `sub:${s.id}:spotted`, title: 'New subscription spotted', body: `${s.name} — ${aud(s.amount)}. Track it or dismiss it.`, url: '/recurring' })
      else if (h.length > 1 && h[h.length - 1].amount > h[h.length - 2].amount) {
        out.push({ kind: 'subs', key: `sub:${s.id}:price:${h[h.length - 1].amount}`, title: `${s.name} went up`, body: `${aud(h[h.length - 2].amount)} → ${aud(h[h.length - 1].amount)}`, url: '/recurring' })
      }
    }
    return out.filter((a) => !sent.has(`${owner}|${a.key}`))
  }

  let delivered = 0
  const stale: string[] = []
  for (const owner of owners) {
    const alerts = alertsFor(owner)
    if (alerts.length === 0) continue
    const devices = subscriptions.filter((s) => s.owner_id === owner)
    const sentKeys = new Set<string>()
    for (const d of devices) {
      for (const a of alerts) {
        if (d.prefs?.[a.kind] === false) continue
        try {
          await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify({ title: a.title, body: a.body, url: a.url, tag: a.key }))
          sentKeys.add(a.key)
          delivered++
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) { stale.push(d.id); break } // device unsubscribed
        }
      }
    }
    if (sentKeys.size > 0) await db.from('budget_push_log').upsert([...sentKeys].map((key) => ({ owner_id: owner, key })), { onConflict: 'owner_id,key' })
  }
  if (stale.length > 0) await db.from('budget_push_subscriptions').delete().in('id', stale)

  return new Response(JSON.stringify({ delivered, pruned: stale.length }), { headers: { 'Content-Type': 'application/json' } })
})
