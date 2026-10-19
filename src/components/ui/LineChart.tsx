import { useMemo, useRef, useState } from 'react'

export interface LinePoint {
  x: string
  y: number
}

/**
 * Single-series line chart: 2px line, recessive grid, a zero line when the
 * series crosses it, and a crosshair + tooltip on hover/touch. One series, so
 * no legend — the card title names it.
 */
export function LineChart({ points, formatY, formatX, height = 160, label, markLowest = false, zeroBased = true }: {
  points: LinePoint[]
  formatY: (n: number) => string
  formatX: (x: string) => string
  height?: number
  label: string
  markLowest?: boolean
  /** include $0 in the range (balances that can dip below zero); off for trends far from zero */
  zeroBased?: boolean
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 320
  const H = height
  // top/bottom padding leaves room for the range labels
  const pad = { l: 4, r: 4, t: 20, b: 22 }

  const geo = useMemo(() => {
    if (points.length === 0) return null
    const ys = points.map((p) => p.y)
    let lo = zeroBased ? Math.min(0, ...ys) : Math.min(...ys)
    let hi = zeroBased ? Math.max(0, ...ys) : Math.max(...ys)
    if (hi === lo) hi = lo + 1
    const span = hi - lo
    lo -= span * 0.05
    hi += span * 0.08
    const x = (i: number) => pad.l + (i / Math.max(1, points.length - 1)) * (W - pad.l - pad.r)
    const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b)
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')
    const lowestIdx = ys.indexOf(Math.min(...ys))
    return { x, y, d, lowestIdx, zeroY: y(0), crosses: Math.min(...ys) < 0, showZero: lo <= 0 && hi >= 0, top: Math.max(...ys), bottom: zeroBased ? Math.min(0, ...ys) : Math.min(...ys) }
  }, [points, H, zeroBased])

  if (!geo) return null

  const pick = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const rel = ((clientX - box.left) / box.width) * W
    const i = Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }

  const h = hover !== null ? points[hover] : null
  const first = points[0]
  const last = points[points.length - 1]
  const low = points[geo.lowestIdx]

  return (
    <figure style={{ margin: 0, position: 'relative' }}>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: ${formatY(first.y)} on ${formatX(first.x)} to ${formatY(last.y)} on ${formatX(last.x)}; lowest ${formatY(low.y)} on ${formatX(low.x)}.`}
        style={{ display: 'block', touchAction: 'pan-y', cursor: 'crosshair' }}
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX)}
        onTouchMove={(e) => pick(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + f * (H - pad.t - pad.b)} y2={pad.t + f * (H - pad.t - pad.b)} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {geo.showZero && <line x1={pad.l} x2={W - pad.r} y1={geo.zeroY} y2={geo.zeroY} stroke={geo.crosses ? 'var(--danger-strong)' : 'var(--dim)'} strokeWidth="1" strokeDasharray={geo.crosses ? '4 3' : undefined} vectorEffect="non-scaling-stroke" opacity={0.7} />}
        <path d={geo.d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {markLowest && (
          <circle cx={geo.x(geo.lowestIdx)} cy={geo.y(low.y)} r="4" fill={low.y < 0 ? 'var(--danger-strong)' : 'var(--warn)'} stroke="var(--bg, #0b2233)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        )}
        {h && hover !== null && (
          <>
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--dim)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={geo.x(hover)} cy={geo.y(h.y)} r="4" fill="var(--accent)" stroke="var(--bg, #0b2233)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <span className="txn__sub" style={{ position: 'absolute', left: 4, top: 0, lineHeight: '16px', pointerEvents: 'none' }}>{formatY(geo.top)}</span>
      {geo.bottom !== geo.top && <span className="txn__sub" style={{ position: 'absolute', left: 4, top: H - 18, lineHeight: '16px', pointerEvents: 'none' }}>{formatY(geo.bottom)}</span>}
      <div className="row--between txn__sub" style={{ marginTop: 2 }}>
        <span>{formatX(first.x)}</span>
        <span>{formatX(last.x)}</span>
      </div>
      {h && hover !== null && (
        <div className="chart-tip" style={{ left: `${Math.min(80, Math.max(0, (geo.x(hover) / W) * 100 - 10))}%` }}>
          <div className="txn__sub">{formatX(h.x)}</div>
          <strong>{formatY(h.y)}</strong>
        </div>
      )}
    </figure>
  )
}
