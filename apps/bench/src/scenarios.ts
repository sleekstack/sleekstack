/**
 * Shared workloads: every library runs the identical scenario defined here, so the comparison is only as fair as this file.
 * An adapter returns the measured body; everything before `return` is setup and runs outside measurement.
 * The body returns the observable final state, which `check` compares across libraries once, before measuring.
 *
 * Idiomatic usage per library:
 * - SleekStack: one `AtomStore` per app, `Atom.make` for state and derived atoms, `store.batch` for grouped writes.
 * - jotai (https://jotai.org/docs/guides/using-store-outside-react): `createStore()` + `atom()`; a write-only atom groups writes.
 * - @effect-atom/atom (https://github.com/tim-smart/effect-atom): `Registry.make()` + `Atom.make`; `Atom.batch` groups writes.
 * - React (https://react.dev/reference/react-dom): `createElement`, `react-dom/server` and `createRoot` + `flushSync`.
 */
import * as EA from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import { Atom, makeAtomStore } from '@sleekstack/core'
import { atom as jAtom, createStore } from 'jotai/vanilla'

export type Library = 'sleekstack' | 'jotai' | 'effect-atom' | 'react' | 'direct'

/** A measured body: sync or async; its return value is the final state used by the correctness check. */
export type Body = () => unknown
/** `'n/a'`: the library cannot express this scenario; it is listed, never silently omitted. */
export type Adapter = ((size: number) => Body | Promise<Body>) | 'n/a'

export interface AtomScenario {
  name: string
  sizes: readonly number[]
  adapters: Partial<Record<Library, Adapter>>
}

/** Runs each adapter once outside measurement; throws naming library and case when final states differ. */
export const check = async (caseName: string, bodies: ReadonlyArray<readonly [Library, Body]>): Promise<void> => {
  let expected: { lib: Library; json: string } | undefined
  for (const [lib, body] of bodies) {
    const json = JSON.stringify(await body())
    if (!expected) expected = { lib, json }
    else if (json !== expected.json)
      throw new Error(`Correctness check failed: ${lib} in "${caseName}" produced ${json.slice(0, 200)}, ${expected.lib} produced ${expected.json.slice(0, 200)}`)
  }
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

// ---- atoms ----

export const atomScenarios: ReadonlyArray<AtomScenario> = [
  {
    name: 'create',
    sizes: [1000],
    adapters: {
      sleekstack: (n) => () => {
        const s = makeAtomStore()
        let sum = 0
        for (const i of range(n)) sum += s.get(Atom.make(i))
        return sum
      },
      jotai: (n) => () => {
        const s = createStore()
        let sum = 0
        for (const i of range(n)) sum += s.get(jAtom(i))
        return sum
      },
      'effect-atom': (n) => () => {
        const r = Registry.make()
        let sum = 0
        for (const i of range(n)) sum += r.get(EA.make(i))
        return sum
      },
    },
  },
  {
    name: 'read',
    sizes: [1000],
    adapters: {
      sleekstack: (n) => {
        const s = makeAtomStore()
        const a = Atom.make(1)
        s.mount(a)
        return () => {
          let sum = 0
          for (let i = 0; i < n; i++) sum += s.get(a)
          return sum
        }
      },
      jotai: (n) => {
        const s = createStore()
        const a = jAtom(1)
        s.sub(a, () => {})
        return () => {
          let sum = 0
          for (let i = 0; i < n; i++) sum += s.get(a)
          return sum
        }
      },
      'effect-atom': (n) => {
        const r = Registry.make()
        const a = EA.make(1)
        r.mount(a)
        return () => {
          let sum = 0
          for (let i = 0; i < n; i++) sum += r.get(a)
          return sum
        }
      },
    },
  },
  {
    name: 'write',
    sizes: [1000],
    adapters: {
      sleekstack: (n) => {
        const s = makeAtomStore()
        const a = Atom.make(0)
        s.mount(a)
        return () => {
          for (let i = 1; i <= n; i++) s.set(a, i)
          return s.get(a)
        }
      },
      jotai: (n) => {
        const s = createStore()
        const a = jAtom(0)
        s.sub(a, () => {})
        return () => {
          for (let i = 1; i <= n; i++) s.set(a, i)
          return s.get(a)
        }
      },
      'effect-atom': (n) => {
        const r = Registry.make()
        const a = EA.make(0)
        r.mount(a)
        return () => {
          for (let i = 1; i <= n; i++) r.set(a, i)
          return r.get(a)
        }
      },
    },
  },
  {
    name: 'derived-read',
    sizes: [1000],
    adapters: {
      sleekstack: (n) => {
        const s = makeAtomStore()
        const a = Atom.make(0)
        const d = Atom.make((get) => get(a) * 2)
        s.mount(d)
        return () => {
          let sum = 0
          for (let i = 1; i <= n; i++) (s.set(a, i), (sum += s.get(d)))
          return sum
        }
      },
      jotai: (n) => {
        const s = createStore()
        const a = jAtom(0)
        const d = jAtom((get) => get(a) * 2)
        s.sub(d, () => {})
        return () => {
          let sum = 0
          for (let i = 1; i <= n; i++) (s.set(a, i), (sum += s.get(d)))
          return sum
        }
      },
      'effect-atom': (n) => {
        const r = Registry.make()
        const a = EA.make(0)
        const d = EA.make((get) => get(a) * 2)
        r.mount(d)
        return () => {
          let sum = 0
          for (let i = 1; i <= n; i++) (r.set(a, i), (sum += r.get(d)))
          return sum
        }
      },
    },
  },
  {
    name: 'subscribe-notify',
    sizes: [1, 100, 1000],
    adapters: {
      sleekstack: (n) => {
        const s = makeAtomStore()
        const a = Atom.make(0)
        let calls = 0
        for (let i = 0; i < n; i++) s.subscribe(a, () => void calls++)
        let v = 0
        return () => {
          calls = 0
          s.set(a, ++v)
          return calls
        }
      },
      jotai: (n) => {
        const s = createStore()
        const a = jAtom(0)
        let calls = 0
        for (let i = 0; i < n; i++) s.sub(a, () => void calls++)
        let v = 0
        return () => {
          calls = 0
          s.set(a, ++v)
          return calls
        }
      },
      'effect-atom': (n) => {
        const r = Registry.make()
        const a = EA.make(0)
        let calls = 0
        for (let i = 0; i < n; i++) r.subscribe(a, () => void calls++)
        let v = 0
        return () => {
          calls = 0
          r.set(a, ++v)
          return calls
        }
      },
    },
  },
  {
    // `size` atoms written in one batch; one subscriber on their sum must fire once.
    name: 'batch-write',
    sizes: [100],
    adapters: {
      sleekstack: (n) => {
        const s = makeAtomStore()
        const atoms = range(n).map(() => Atom.make(0))
        const sum = Atom.make((get) => atoms.reduce((t, a) => t + get(a), 0))
        let calls = 0
        s.subscribe(sum, () => void calls++)
        let v = 0
        return () => {
          calls = 0
          v++
          s.batch(() => atoms.forEach((a) => s.set(a, v)))
          { const total = s.get(sum) / v; return [calls, total] }
        }
      },
      jotai: (n) => {
        const s = createStore()
        const atoms = range(n).map(() => jAtom(0))
        const sum = jAtom((get) => atoms.reduce((t, a) => t + get(a), 0))
        const setAll = jAtom(null, (_get, set, v: number) => atoms.forEach((a) => set(a, v)))
        let calls = 0
        s.sub(sum, () => void calls++)
        let v = 0
        return () => {
          calls = 0
          s.set(setAll, ++v)
          { const total = s.get(sum) / v; return [calls, total] }
        }
      },
      'effect-atom': (n) => {
        const r = Registry.make()
        const atoms = range(n).map(() => EA.make(0))
        const sum = EA.make((get) => atoms.reduce((t, a) => t + get(a), 0))
        let calls = 0
        r.subscribe(sum, () => void calls++)
        let v = 0
        return () => {
          calls = 0
          v++
          EA.batch(() => atoms.forEach((a) => r.set(a, v)))
          { const total = r.get(sum) / v; return [calls, total] }
        }
      },
    },
  },
  {
    // a -> (b, c) -> d; one write to `a`, `d` subscribed, read `size` times.
    name: 'diamond',
    sizes: [1000],
    adapters: {
      sleekstack: (n) => {
        const s = makeAtomStore()
        const a = Atom.make(0)
        const b = Atom.make((get) => get(a) + 1)
        const c = Atom.make((get) => get(a) * 2)
        const d = Atom.make((get) => get(b) + get(c))
        s.subscribe(d, () => {})
        return () => {
          let sum = 0
          for (let i = 1; i <= n; i++) (s.set(a, i), (sum += s.get(d)))
          return sum
        }
      },
      jotai: (n) => {
        const s = createStore()
        const a = jAtom(0)
        const b = jAtom((get) => get(a) + 1)
        const c = jAtom((get) => get(a) * 2)
        const d = jAtom((get) => get(b) + get(c))
        s.sub(d, () => {})
        return () => {
          let sum = 0
          for (let i = 1; i <= n; i++) (s.set(a, i), (sum += s.get(d)))
          return sum
        }
      },
      'effect-atom': (n) => {
        const r = Registry.make()
        const a = EA.make(0)
        const b = EA.make((get) => get(a) + 1)
        const c = EA.make((get) => get(a) * 2)
        const d = EA.make((get) => get(b) + get(c))
        r.subscribe(d, () => {})
        return () => {
          let sum = 0
          for (let i = 1; i <= n; i++) (r.set(a, i), (sum += r.get(d)))
          return sum
        }
      },
    },
  },
]

// ---- render ----

/** Fixed list tree: `<ul>` with ROWS `<li class="row">Item i</li>` children, 1k nodes plus text. */
export const ROWS = 1000
export const rowIds = range(ROWS)

/** A JSX-runtime-shaped factory, so one tree definition serves SleekStack (`jsx`) and the direct-call reference. */
type Jsx = (type: any, props: any) => any

/** List variants: `keyed` adds `key` per row (the row id), `ids` sets row order, `label` sets row text. */
export interface TreeOptions {
  keyed?: boolean
  ids?: ReadonlyArray<number>
  label?: (i: number) => string
}
export const rowLabel = (i: number) => `Item ${i}`

/** The list tree, SleekStack side: `<ul>` of `Row` components; `Row` 0 may be swapped for a reactive row. */
// Module-level so the component type is stable across re-renders and the reconciler can reuse rows.
const Row = ({ jsx, i, label }: { jsx: Jsx; i: number; label: (i: number) => string }) => jsx('li', { className: 'row', children: label(i) })
export const sleekTree = (jsx: Jsx, first?: () => unknown, { keyed = false, ids = rowIds, label = rowLabel }: TreeOptions = {}) =>
  jsx('ul', { children: ids.map((i) => (i === 0 && first ? jsx(first, {}) : jsx(Row, keyed ? { jsx, i, label, key: i } : { jsx, i, label }))) })

/**
 * Data-shaped keyed list: each row takes an item object, never a fresh closure, so a row whose item is the same object has
 * unchanged props. `runs` counts row-component executions (reset by the caller); it is outside measurement's reach.
 */
export interface Item {
  readonly id: number
  readonly label: string
}
export const baseItems: ReadonlyArray<Item> = rowIds.map((i) => ({ id: i, label: rowLabel(i) }))
/** Item list after write `n`: row 500 is a new object, every other item keeps its identity. */
export const itemsAfter = (n: number): ReadonlyArray<Item> => baseItems.map((it) => (it.id === 500 ? { id: 500, label: `Item 500 #${n}` } : it))
export const dataRuns = { sleekstack: 0, react: 0 }
const DataRow = ({ jsx, item }: { jsx: Jsx; item: Item }) => (dataRuns.sleekstack++, jsx('li', { className: 'row', children: item.label }))
export const sleekDataTree = (jsx: Jsx, items: ReadonlyArray<Item>) => jsx('ul', { children: items.map((item) => jsx(DataRow, { jsx, item, key: item.id })) })
