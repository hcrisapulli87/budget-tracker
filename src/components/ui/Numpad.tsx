const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const

export function Numpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const press = (k: string) => {
    if (k === '⌫') return onChange(value.slice(0, -1))
    if (k === '.') {
      if (value.includes('.')) return
      return onChange(value === '' ? '0.' : `${value}.`)
    }
    const next = value + k
    const [, dec] = next.split('.')
    if (dec !== undefined && dec.length > 2) return
    if (next.replace('.', '').length > 7) return
    onChange(next === '0' ? '0' : next.replace(/^0(?=\d)/, ''))
  }
  return (
    <div className="numpad">
      {KEYS.map((k) => (
        <button key={k} type="button" onClick={() => press(k)}>{k}</button>
      ))}
    </div>
  )
}
