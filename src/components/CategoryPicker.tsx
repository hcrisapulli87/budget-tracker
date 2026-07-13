import type { Category } from '../data/types'

export function CategoryPicker({ categories, onPick, onClose }: {
  categories: Category[]
  onPick: (categoryId: string) => void
  onClose: () => void
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Category</h2>
        {categories.map((c) => (
          <button key={c.id} className="btn" style={{ textAlign: 'left' }} onClick={() => onPick(c.id)}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>
    </div>
  )
}
