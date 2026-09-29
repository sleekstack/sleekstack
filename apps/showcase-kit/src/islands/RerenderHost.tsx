'use client'
import { useState } from 'react'
import { Island } from './islands.client'

/** Re-renders the Island wrapper on demand (fresh props object each time). */
export function RerenderHost() {
  const [n, setN] = useState(0)
  return (
    <section aria-label="visible island">
      <button type="button" onClick={() => setN(n + 1)}>{`rerender wrapper ${n}`}</button>
      <Island name="counter" props={{ start: 3 }} hydrate="visible" />
    </section>
  )
}
