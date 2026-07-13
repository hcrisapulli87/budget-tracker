import type { ReactNode } from 'react'

export function StatCard({ label, value, sub, children }: { label: string; value: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="statcard">
      <div className="statcard__label">{label}</div>
      <div className="statcard__value">{value}</div>
      {sub && <div className="statcard__sub">{sub}</div>}
      {children}
    </div>
  )
}
