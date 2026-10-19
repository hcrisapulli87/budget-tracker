import { useCallback, useEffect, useState } from 'react'
import { addComment, deleteComment, fetchComments } from '../data/comments'
import { useData } from '../data/DataProvider'
import { formatDayMonth } from '../domain/money'
import { PersonAvatar } from './ui/PersonAvatar'
import type { Comment } from '../data/types'

const QUICK = ['What was this?', 'Shared?', '👍', '😬']

/** "What was this?" — either person can comment on either person's transaction. */
export function CommentThread({ txnId, onChanged }: { txnId: string; onChanged?: () => void }) {
  const { me, profiles } = useData()
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetchComments(txnId).then(setComments).catch(() => setComments([]))
  }, [txnId])
  useEffect(load, [load])

  const post = async (body: string) => {
    const text = body.trim().slice(0, 500)
    if (!text || !me) return
    setBusy(true)
    try {
      await addComment(txnId, me.id, text)
      setDraft('')
      load()
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    await deleteComment(id)
    load()
    onChanged?.()
  }

  const name = (id: string) => profiles.find((p) => p.id === id)?.display_name ?? '?'

  return (
    <div className="card" style={{ margin: 0 }}>
      <h2>Comments</h2>
      {comments.map((c) => (
        <div key={c.id} className="row" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
          <PersonAvatar name={name(c.author_id)} isMe={c.author_id === me?.id} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="txn__sub">{name(c.author_id)} · {formatDayMonth(c.created_at.slice(0, 10))}</div>
            <div style={{ fontSize: '0.9rem', overflowWrap: 'anywhere' }}>{c.body}</div>
          </div>
          {c.author_id === me?.id && <button className="btn btn--small" onClick={() => void remove(c.id)} aria-label="Delete comment">✕</button>}
        </div>
      ))}
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {QUICK.map((q) => <button key={q} className="chip" disabled={busy} onClick={() => void post(q)}>{q}</button>)}
      </div>
      <div className="row">
        <input className="input" placeholder="Add a comment…" value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void post(draft) }} />
        <button className="btn" disabled={busy || !draft.trim()} onClick={() => void post(draft)}>Send</button>
      </div>
    </div>
  )
}
