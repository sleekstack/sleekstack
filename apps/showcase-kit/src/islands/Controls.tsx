'use client'
import { useEffect, useState } from 'react'

/** Interaction-trigger island: a plain button, a checkbox and a link, for the click-replay e2e test. */
export default function Controls({ id }: { readonly id: string }) {
  const [clicks, setClicks] = useState(0)
  const [linkClicks, setLinkClicks] = useState(0)
  useEffect(() => {
    const w = window as { __hydrated?: Record<string, boolean> }
    ;(w.__hydrated ??= {})[id] = true
  }, [id])
  return (
    <div>
      <button type="button" onClick={() => setClicks((n) => n + 1)}>{`clicks ${clicks}`}</button>
      <input type="checkbox" aria-label="check" />
      <a href={`#${id}`} onClick={() => setLinkClicks((n) => n + 1)}>{`link ${linkClicks}`}</a>
    </div>
  )
}
