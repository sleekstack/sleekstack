/**
 * Graph shapes from the popular signal benchmarks, run through one library-neutral API so every library does the same work:
 * - milomg/js-reactivity-benchmark, "kairo" cases (deep/broad propagation, diamond, triangle, mux, repeated observers, avoidable propagation):
 *   https://github.com/milomg/js-reactivity-benchmark
 * - cellx layered graph (4 sources, each layer computed from the previous one): https://github.com/Riim/cellx
 * The scenarios are modeled on those suites, not copied: sizes follow the originals where noted, the harness is this repo's.
 *
 * Idiomatic wiring per library, as in scenarios.ts: a computed is a derived atom that reads its inputs through the atom's `get`;
 * an effect is a derived atom with a no-op subscriber, so it re-runs when an input changes.
 */
import * as EA from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import { Atom, makeAtomStore } from '@sleekstack/core'
import { createEffect, createMemo, createRoot, createSignal } from 'solid-js'
import { atom as jAtom, createStore } from 'jotai/vanilla'

export interface Source<T> {
  read(): T
  write(value: T): void
}
export interface Derived<T> {
  read(): T
}
export interface Api {
  signal<T>(value: T): Source<T>
  computed<T>(fn: () => T): Derived<T>
  effect(fn: () => void): void
}
export type Lib = 'sleekstack' | 'jotai' | 'effect-atom' | 'solid'
/** Builds a graph on a fresh store; the returned body is what is measured. */
export type Build = <T>(graph: (api: Api) => T) => T

type Get = (atom: any) => any
// The `get` of the atom being computed, so `read()` can be called without it (the neutral API has no `get` parameter).
const tracking = () => {
  let current: Get | undefined
  return {
    run: <T>(get: Get, fn: () => T): T => {
      const previous = current
      current = get
      try {
        return fn()
      } finally {
        current = previous
      }
    },
    read: <A>(atom: A, direct: (atom: A) => unknown) => (current ? current(atom) : direct(atom)),
  }
}

export const builders: Record<Lib, Build> = {
  sleekstack: (graph) => {
    const s = makeAtomStore()
    const t = tracking()
    return graph({
      signal: (v) => {
        const a = Atom.make(v)
        s.mount(a)
        return { read: () => t.read(a, (x) => s.get(x)) as typeof v, write: (x) => s.set(a, x) }
      },
      computed: (fn) => {
        const a = Atom.make((get) => t.run(get as Get, fn))
        return { read: () => t.read(a, (x) => s.get(x)) as ReturnType<typeof fn> }
      },
      effect: (fn) => void s.mount(Atom.make((get) => t.run(get as Get, fn))),
    })
  },
  jotai: (graph) => {
    const s = createStore()
    const t = tracking()
    return graph({
      signal: (v) => {
        const a = jAtom(v)
        s.sub(a, () => {})
        return { read: () => t.read(a, (x) => s.get(x)) as typeof v, write: (x) => s.set(a, x as never) }
      },
      computed: (fn) => {
        const a = jAtom((get) => t.run(get as Get, fn))
        return { read: () => t.read(a, (x) => s.get(x)) }
      },
      effect: (fn) =>
        void s.sub(
          jAtom((get) => t.run(get as Get, fn)),
          () => {},
        ),
    })
  },
  'effect-atom': (graph) => {
    const r = Registry.make()
    const t = tracking()
    return graph({
      signal: (v) => {
        const a = EA.make(v)
        r.mount(a)
        return { read: () => t.read(a, (x) => r.get(x)) as typeof v, write: (x) => r.set(a, x) }
      },
      computed: (fn) => {
        const a = EA.make((get) => t.run(get as Get, fn))
        return { read: () => t.read(a, (x) => r.get(x)) }
      },
      // effect-atom builds a node on its first read and recomputes a subscribed node when it is read: read it once now and in the listener.
      effect: (fn) => {
        const a = EA.make((get) => t.run(get as Get, fn))
        r.subscribe(a, () => r.get(a))
        r.get(a)
      },
    })
  },
  solid: (graph) =>
    createRoot(() =>
      graph({
        signal: (v) => {
          const [read, write] = createSignal(v)
          return { read, write: (x) => void write(() => x) }
        },
        computed: (fn) => ({ read: createMemo(fn) }),
        effect: (fn) => createEffect(fn),
      }),
    ),
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const sum = (xs: ReadonlyArray<number>) => xs.reduce((a, b) => a + b, 0)

export interface ReactivityScenario {
  /** Case name under `reactivity/`. */
  name: string
  /** One write round: the observable result is compared across libraries before measuring. */
  make: (api: Api) => () => unknown
  /** Libraries that cannot run this case; listed in the output, never silently omitted. */
  unsupported?: Partial<Record<Lib, string>>
}

/** kairo `deepPropagation`: a chain of 50 computeds under one effect. */
const deep =
  (len: number): ReactivityScenario['make'] =>
  (api) => {
    const head = api.signal(0)
    let last: Derived<number> = head
    for (let i = 0; i < len; i++) {
      const prev = last
      last = api.computed(() => prev.read() + 1)
    }
    api.effect(() => void last.read())
    let v = 0
    return () => {
      head.write(++v)
      return last.read()
    }
  }

/** kairo `broadPropagation`: one source feeding 50 two-step chains, each with its own effect. */
const broad =
  (width: number): ReactivityScenario['make'] =>
  (api) => {
    const head = api.signal(0)
    const ends = range(width).map((i) => {
      const mid = api.computed(() => head.read() + i)
      const end = api.computed(() => mid.read() + 1)
      api.effect(() => void end.read())
      return end
    })
    let v = 0
    return () => {
      head.write(++v)
      return sum(ends.map((e) => e.read()))
    }
  }

/** kairo `diamond`: one source, `width` parallel computeds, one sum. */
const diamond =
  (width: number): ReactivityScenario['make'] =>
  (api) => {
    const head = api.signal(0)
    const mids = range(width).map((i) => api.computed(() => head.read() + i))
    const total = api.computed(() => sum(mids.map((m) => m.read())))
    api.effect(() => void total.read())
    let v = 0
    return () => {
      head.write(++v)
      return total.read()
    }
  }

/** kairo `triangle`: a chain of `width` computeds whose every step also feeds one sum. */
const triangle =
  (width: number): ReactivityScenario['make'] =>
  (api) => {
    const head = api.signal(0)
    const steps: Array<Derived<number>> = []
    let last: Derived<number> = head
    for (let i = 0; i < width; i++) {
      const prev = last
      steps.push((last = api.computed(() => prev.read() + 1)))
    }
    const total = api.computed(() => sum(steps.map((s) => s.read())))
    api.effect(() => void total.read())
    let v = 0
    return () => {
      head.write(++v)
      return total.read()
    }
  }

/** kairo `mux`: 100 sources into one object computed, split back out; writing 10 of them must wake only those effects. */
const mux =
  (width: number): ReactivityScenario['make'] =>
  (api) => {
    const heads = range(width).map(() => api.signal(0))
    const whole = api.computed(() => heads.map((h) => h.read()))
    const parts = range(width).map((i) => {
      const part = api.computed(() => whole.read()[i]! + 1)
      api.effect(() => void part.read())
      return part
    })
    let v = 0
    return () => {
      v++
      for (let i = 0; i < 10; i++) heads[i]!.write(v + i)
      return sum(parts.map((p) => p.read()))
    }
  }

/** kairo `repeatedObservers`: one computed reads the same source `size` times. */
const repeated =
  (size: number): ReactivityScenario['make'] =>
  (api) => {
    const head = api.signal(0)
    const total = api.computed(() => {
      let r = 0
      for (let i = 0; i < size; i++) r += head.read()
      return r
    })
    api.effect(() => void total.read())
    let v = 0
    return () => {
      head.write(++v)
      return total.read()
    }
  }

/** kairo `avoidablePropagation`: the middle computed is constant, so nothing below it should re-run. */
const avoidable: ReactivityScenario['make'] = (api) => {
  const head = api.signal(0)
  const c1 = api.computed(() => head.read())
  const c2 = api.computed(() => (c1.read(), 0))
  const c3 = api.computed(() => c2.read() + 1)
  const c4 = api.computed(() => c3.read() + 2)
  const c5 = api.computed(() => c4.read() + 3)
  api.effect(() => void c5.read())
  let v = 0
  return () => {
    head.write(++v)
    return c5.read()
  }
}

/** cellx layered graph: four sources, each layer's a/b/c/d computed from the previous layer; two write rounds alternate. */
const cellx =
  (layers: number): ReactivityScenario['make'] =>
  (api) => {
    const start = { a: api.signal(1), b: api.signal(2), c: api.signal(3), d: api.signal(4) }
    type Layer = { a: Derived<number>; b: Derived<number>; c: Derived<number>; d: Derived<number> }
    let layer: Layer = start
    for (let i = 0; i < layers; i++) {
      const p = layer
      layer = {
        a: api.computed(() => p.b.read()),
        b: api.computed(() => p.a.read() - p.c.read()),
        c: api.computed(() => p.b.read() * p.d.read()),
        d: api.computed(() => p.c.read()),
      }
    }
    const end = layer
    for (const k of ['a', 'b', 'c', 'd'] as const) api.effect(() => void end[k].read())
    let flip = false
    return () => {
      flip = !flip
      const [a, b, c, d] = flip ? [4, 3, 2, 1] : [1, 2, 3, 4]
      start.a.write(a)
      start.b.write(b)
      start.c.write(c)
      start.d.write(d)
      return [end.a.read(), end.b.read(), end.c.read(), end.d.read()]
    }
  }

// effect-atom 0.7.1 walks every path of the dependency graph when it invalidates (no visited set), so a layered graph with
// four parents per node grows exponentially and throws `RangeError: Invalid array length` from `childrenAreActive`.
const EA_LAYERS = 'RangeError: Invalid array length in invalidate (path explosion on layered graphs)'

export const reactivityScenarios: ReadonlyArray<ReactivityScenario> = [
  { name: 'kairo-deep-50', make: deep(50) },
  { name: 'kairo-broad-50', make: broad(50) },
  { name: 'kairo-diamond-5', make: diamond(5) },
  { name: 'kairo-triangle-10', make: triangle(10) },
  { name: 'kairo-mux-100', make: mux(100) },
  { name: 'kairo-repeated-30', make: repeated(30) },
  { name: 'kairo-avoidable', make: avoidable },
  { name: 'cellx-10-layers', make: cellx(10) },
  { name: 'cellx-100-layers', make: cellx(100), unsupported: { 'effect-atom': EA_LAYERS } },
  { name: 'cellx-500-layers', make: cellx(500), unsupported: { 'effect-atom': EA_LAYERS } },
]
