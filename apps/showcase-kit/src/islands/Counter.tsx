'use client'
import { useState } from 'react'

/** Island component; logs each client render so the e2e test can see when it hydrates. */
export default function Counter({ start }: { readonly start: number }) {
  const [n, setN] = useState(start)
  if (typeof window !== 'undefined') {
    const w = window as { __islandRenders?: number }
    w.__islandRenders = (w.__islandRenders ?? 0) + 1
  }
  return (
    <button type="button" onClick={() => setN(n + 1)}>
      {`count ${n}`}
    </button>
  )
}
