/** Solid reference adapters for the atom scenarios (signals, memos, effects; no DOM). */
import { batch, createEffect, createMemo, createRoot, createSignal } from 'solid-js'
import type { Adapter } from './scenarios'

const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const root = <T>(fn: () => T): T => createRoot(fn)

export const solidAdapters: Record<string, Adapter> = {
  create: (n) => () => {
    let sum = 0
    for (const i of range(n)) sum += createSignal(i)[0]()
    return sum
  },
  read: (n) => {
    const [a] = createSignal(1)
    return () => {
      let sum = 0
      for (let i = 0; i < n; i++) sum += a()
      return sum
    }
  },
  write: (n) => {
    const [a, setA] = createSignal(0)
    return () => {
      for (let i = 1; i <= n; i++) setA(i)
      return a()
    }
  },
  'derived-read': (n) =>
    root(() => {
      const [a, setA] = createSignal(0)
      const d = createMemo(() => a() * 2)
      return () => {
        let sum = 0
        for (let i = 1; i <= n; i++) (setA(i), (sum += d()))
        return sum
      }
    }),
  'subscribe-notify': (n) =>
    root(() => {
      const [a, setA] = createSignal(0)
      let calls = 0
      for (let i = 0; i < n; i++)
        createEffect(() => {
          a()
          calls++
        })
      let v = 0
      return () => {
        calls = 0
        setA(++v)
        return calls
      }
    }),
  'batch-write': (n) =>
    root(() => {
      const sigs = range(n).map(() => createSignal(0))
      const sum = createMemo(() => sigs.reduce((t, [g]) => t + g(), 0))
      let calls = 0
      createEffect(() => {
        sum()
        calls++
      })
      let v = 0
      return () => {
        calls = 0
        v++
        batch(() => sigs.forEach(([, set]) => set(v)))
        return [calls, sum() / v]
      }
    }),
  diamond: (n) =>
    root(() => {
      const [a, setA] = createSignal(0)
      const b = createMemo(() => a() + 1)
      const c = createMemo(() => a() * 2)
      const d = createMemo(() => b() + c())
      createEffect(() => void d())
      return () => {
        let sum = 0
        for (let i = 1; i <= n; i++) (setA(i), (sum += d()))
        return sum
      }
    }),
}
