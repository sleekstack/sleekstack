'use client'
import { useEffect, useId, useState } from 'react'

/** Calls `useId` to pin how a fresh Island root's id tree hydrates against the server HTML. */
export default function Ided() {
  const id = useId()
  const [n, setN] = useState(0)
  useEffect(() => {
    const w = window as { __hydrated?: Record<string, boolean>; __clientUseId?: string }
    ;(w.__hydrated ??= {}).ided = true
    w.__clientUseId = id
  }, [id])
  return (
    <div>
      <label htmlFor={id}>named field</label>
      <input id={id} />
      <button type="button" onClick={() => setN(n + 1)}>{`ided ${n}`}</button>
    </div>
  )
}
