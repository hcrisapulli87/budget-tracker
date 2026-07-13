export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 8px' }}>
      <div style={{ fontSize: '1.8rem' }}>{icon}</div>
      <div style={{ fontWeight: 600, marginTop: 4 }}>{title}</div>
      {hint && <p className="muted" style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>{hint}</p>}
    </div>
  )
}
