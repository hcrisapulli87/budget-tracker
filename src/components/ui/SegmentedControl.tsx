interface Option<T extends string> { value: T; label: string }

export function SegmentedControl<T extends string>({ options, value, onChange, grow }: {
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  grow?: boolean
}) {
  return (
    <div className={`seg${grow ? ' seg--grow' : ''}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} className={`seg__opt${o.value === value ? ' active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
