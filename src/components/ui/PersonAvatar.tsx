/**
 * PersonAvatar — the couple-first identity chip. "You" (the signed-in user)
 * always reads --accent (cyan); the partner reads --accent-2 (indigo). Rows,
 * headers and the settle-up card all compose these so who-did-what is glanceable.
 */
interface Props {
  name: string
  isMe: boolean
  size?: number
}

export function PersonAvatar({ name, isMe, size = 26 }: Props) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <span
      className={`avatar ${isMe ? 'avatar--you' : 'avatar--partner'}`}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
      title={name}
      aria-label={name}
    >
      {initial}
    </span>
  )
}

/** Overlapping cluster for the "both of us" couple view. */
export function AvatarStack({ people, size = 26 }: { people: { name: string; isMe: boolean }[]; size?: number }) {
  return (
    <span className="avatar-stack">
      {people.map((p, i) => (
        <PersonAvatar key={i} name={p.name} isMe={p.isMe} size={size} />
      ))}
    </span>
  )
}
