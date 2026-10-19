import { supabase } from '../lib/supabase'

export interface PushPrefs {
  bills: boolean
  budgets: boolean
  subs: boolean
}

export const DEFAULT_PREFS: PushPrefs = { bills: true, budgets: true, subs: true }
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Push needs a service worker, PushManager, and (on iPhone) the app added to the Home Screen. */
export function pushSupport(): 'ok' | 'unsupported' | 'not-configured' | 'install-first' {
  if (!VAPID) return 'not-configured'
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported'
  if (!('PushManager' in window)) {
    // iOS only exposes Web Push to Home Screen apps (iOS 16.4+)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    return ios ? 'install-first' : 'unsupported'
  }
  return 'ok'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function currentPush(): Promise<{ endpoint: string; prefs: PushPrefs } | null> {
  if (pushSupport() !== 'ok') return null
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return null
  const { data } = await supabase.from('budget_push_subscriptions').select('prefs').eq('endpoint', sub.endpoint).maybeSingle()
  return { endpoint: sub.endpoint, prefs: { ...DEFAULT_PREFS, ...((data?.prefs as Partial<PushPrefs>) ?? {}) } }
}

/** Ask permission, subscribe this device, and store the endpoint. Returns false if permission was refused. */
export async function enablePush(ownerId: string, prefs: PushPrefs = DEFAULT_PREFS): Promise<boolean> {
  if (pushSupport() !== 'ok' || !VAPID) return false
  if ((await Notification.requestPermission()) !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }))
  const json = sub.toJSON()
  const { error } = await supabase.from('budget_push_subscriptions').upsert(
    { owner_id: ownerId, endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '', prefs },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
  return true
}

export async function updatePushPrefs(endpoint: string, prefs: PushPrefs): Promise<void> {
  const { error } = await supabase.from('budget_push_subscriptions').update({ prefs }).eq('endpoint', endpoint)
  if (error) throw error
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('budget_push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
