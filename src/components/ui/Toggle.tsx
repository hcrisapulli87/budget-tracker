/** Glass toggle — springs on change, fill shifts to --accent when on. */
interface Props {
  on: boolean
  onChange: (next: boolean) => void
  label?: string
}

export function Toggle({ on, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        width: 46, height: 28, borderRadius: 999, flexShrink: 0, cursor: 'pointer', padding: 3,
        border: '1px solid var(--border)',
        background: on ? 'var(--accent)' : 'var(--glass-2)',
        transition: 'background 200ms ease',
        display: 'inline-flex', justifyContent: on ? 'flex-end' : 'flex-start', alignItems: 'center',
      }}
    >
      <span
        style={{
          width: 20, height: 20, borderRadius: '50%',
          background: on ? 'var(--accent-ink)' : '#fff',
          transition: 'transform 200ms ease',
        }}
      />
    </button>
  )
}
