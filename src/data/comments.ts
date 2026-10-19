import { supabase } from '../lib/supabase'
import type { Comment } from './types'

export async function fetchComments(txnId: string): Promise<Comment[]> {
  const { data, error } = await supabase.from('budget_comments').select('*').eq('txn_id', txnId).order('created_at')
  if (error) throw error
  return (data ?? []) as Comment[]
}

/** Comment counts for a set of transactions (chunked — PostgREST `in` limits). */
export async function fetchCommentCounts(txnIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (let i = 0; i < txnIds.length; i += 200) {
    const { data, error } = await supabase.from('budget_comments').select('txn_id').in('txn_id', txnIds.slice(i, i + 200))
    if (error) throw error
    for (const r of data ?? []) counts.set(r.txn_id as string, (counts.get(r.txn_id as string) ?? 0) + 1)
  }
  return counts
}

/** Latest comments across everyone's transactions — the Home "chat" card. */
export async function fetchRecentComments(limit = 5): Promise<Comment[]> {
  const { data, error } = await supabase.from('budget_comments').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []) as Comment[]
}

export async function addComment(txnId: string, authorId: string, body: string): Promise<void> {
  const { error } = await supabase.from('budget_comments').insert({ txn_id: txnId, author_id: authorId, body, created_at: new Date().toISOString() })
  if (error) throw error
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('budget_comments').delete().eq('id', id)
  if (error) throw error
}
