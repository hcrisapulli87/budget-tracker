import { goalStatus } from '../domain/goals'
import { formatAUD, formatDayMonth } from '../domain/money'
import { ProgressBar } from './ui/ProgressBar'
import type { Goal } from '../data/types'

const STATUS_TEXT = { done: 'done 🎉', ontrack: 'on track', behind: 'behind', overdue: 'past its date', open: '' }

/** Goals with progress and the monthly saving each needs. */
export function GoalsCard({ goals, today, onOpen, onAdd, title = 'Goals' }: {
  goals: Goal[]
  today: string
  onOpen?: (g: Goal) => void
  onAdd?: () => void
  title?: string
}) {
  return (
    <div className="card">
      <div className="row--between">
        <h2>{title}</h2>
        {onAdd && <button className="btn btn--small" onClick={onAdd}>+ Goal</button>}
      </div>
      {goals.length === 0 && <p className="txn__sub" style={{ whiteSpace: 'normal' }}>Saving for something? Add a goal — make it Joint to save for it together.</p>}
      {goals.map((g) => {
        const s = goalStatus(g, today)
        return (
          <button key={g.id} className="txn txn--tap" style={{ display: 'block' }} disabled={!onOpen} onClick={() => onOpen?.(g)}>
            <div className="row--between" style={{ fontSize: '0.9rem', marginBottom: 4 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.icon} {g.name}{g.owner_id === null && <> <span className="badge">Joint</span></>}</span>
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>{formatAUD(g.saved_amount)} of {formatAUD(g.target_amount)}</span>
            </div>
            <ProgressBar value={g.saved_amount} max={g.target_amount} tone={s.status === 'behind' || s.status === 'overdue' ? 'warn' : 'ok'} />
            <div className="txn__sub" style={{ marginTop: 4 }}>
              {s.monthlyNeeded !== null && s.status !== 'done' ? `${formatAUD(s.monthlyNeeded)}/month to hit ${formatDayMonth(g.target_date!)}` : `${Math.round(s.pct * 100)}%`}
              {STATUS_TEXT[s.status] && <> · <span className={s.status === 'behind' || s.status === 'overdue' ? 'warn' : ''}>{STATUS_TEXT[s.status]}</span></>}
            </div>
          </button>
        )
      })}
    </div>
  )
}
