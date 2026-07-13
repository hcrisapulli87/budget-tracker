export function ProgressBar({ value, max, markerAt, tone = 'ok' }: {
  value: number
  max: number
  markerAt?: number
  tone?: 'ok' | 'warn' | 'over'
}) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100)
  const fillClass = tone === 'over' ? ' pbar__fill--over' : tone === 'warn' ? ' pbar__fill--warn' : ''
  return (
    <div className="pbar">
      <div className={`pbar__fill${fillClass}`} style={{ width: `${pct}%` }} />
      {markerAt !== undefined && max > 0 && (
        <div className="pbar__marker" style={{ left: `${Math.min(100, (markerAt / max) * 100)}%` }} />
      )}
    </div>
  )
}
