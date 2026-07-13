import { useState } from 'react'

export type Who = 'mine' | 'all'

/** Person filter, defaulting to "Just me", remembered per device. */
export function useWho(): [Who, (w: Who) => void] {
  const [who, setWhoState] = useState<Who>(() => (localStorage.getItem('tally.who') === 'all' ? 'all' : 'mine'))
  const setWho = (w: Who) => {
    localStorage.setItem('tally.who', w)
    setWhoState(w)
  }
  return [who, setWho]
}
