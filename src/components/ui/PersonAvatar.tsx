/**
 * PersonAvatar — the couple-first identity chip. "You" (the signed-in user)
 * always reads --accent (cyan); the partner reads --accent-2 (indigo). The
 * profile button and the Me/partner switcher use the same colours.
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

