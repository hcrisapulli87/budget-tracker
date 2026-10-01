import { useData } from '../data/DataProvider'

/**
 * Me/partner switcher (RecipeVault pattern): a glass pill of initial circles,
 * the viewed person filled. One selection shared by every screen. Renders
 * nothing until both profiles exist.
 */
export function PersonSwitcher() {
  const { profiles, viewId, me, setViewing } = useData()
  if (profiles.length < 2) return null
  return (
    <div className="person-switch" role="tablist" aria-label="Whose money">
      {profiles.map((p) => {
        const active = p.id === viewId
        const isMe = p.id === me?.id
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={active}
            aria-label={isMe ? `${p.display_name} (you)` : p.display_name}
            title={p.display_name}
            className={`person-switch__btn${active ? ` person-switch__btn--active ${isMe ? 'avatar--you' : 'avatar--partner'}` : ''}`}
            onClick={() => setViewing(p.id)}
          >
            {(p.display_name || '?').trim().charAt(0).toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}

/** Shown across the top of every screen while viewing the partner's data. */
export function PartnerBanner() {
  const { readOnly, viewing, me, setViewing } = useData()
  if (!readOnly || !viewing || !me) return null
  return (
    <button className="partner-banner" onClick={() => setViewing(me.id)}>
      {viewing.display_name}’s money · read-only · <u>back to mine</u>
    </button>
  )
}
