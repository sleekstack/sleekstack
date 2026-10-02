'use client'
/**
 * apps/showcase/src/client/components/ScopeLog.tsx
 *
 * R6/R7: a client-side event log fed by the component-scoped services'
 * acquire/release finalizers (component-services.ts), shown next to the
 * server-side activity log (/log). Module-scope singleton so any component
 * in the tree can record to it; `<ScopeLog>` re-renders on each entry.
 */
import { useEffect, useState } from 'react'

export interface ScopeLogEntry {
  readonly id: number
  readonly message: string
}

type Listener = (entries: readonly ScopeLogEntry[]) => void

let seq = 0
let entries: readonly ScopeLogEntry[] = []
const listeners = new Set<Listener>()

export const scopeLog = {
  record(message: string): void {
    entries = [...entries, { id: ++seq, message }]
    listeners.forEach((listen) => listen(entries))
  },
  list(): readonly ScopeLogEntry[] {
    return entries
  },
  /** Test-only: resets the singleton between test cases. */
  reset(): void {
    entries = []
    seq = 0
    listeners.forEach((listen) => listen(entries))
  },
}

export function ScopeLog() {
  const [list, setList] = useState<readonly ScopeLogEntry[]>(scopeLog.list())
  useEffect(() => {
    listeners.add(setList)
    return () => {
      listeners.delete(setList)
    }
  }, [])

  return (
    <section aria-label="component scope log">
      <h2>Component scope log</h2>
      <ol>
        {list.map((entry) => (
          <li key={entry.id}>{entry.message}</li>
        ))}
      </ol>
    </section>
  )
}
