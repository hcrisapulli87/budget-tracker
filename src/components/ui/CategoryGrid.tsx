import { IconCircle } from './IconCircle'
import type { Category } from '../../data/types'

export function CategoryGrid({ categories, value, onPick }: {
  categories: Category[]
  value: string | null
  onPick: (id: string) => void
}) {
  return (
    <div className="catgrid">
      {categories.map((c) => (
        <button key={c.id} type="button" className={`catgrid__tile${c.id === value ? ' active' : ''}`} onClick={() => onPick(c.id)}>
          <IconCircle icon={c.icon} colour={c.colour} size={32} />
          <span className="name">{c.name}</span>
        </button>
      ))}
    </div>
  )
}
