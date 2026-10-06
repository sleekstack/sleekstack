// @vitest-environment jsdom
/**
 * The operations of krausest/js-framework-benchmark (https://github.com/krausest/js-framework-benchmark), the usual way
 * frameworks are compared on GitHub: a table of rows `{ id, label }` with the same markup and the same operations
 * (create, replace, partial update, select, swap, remove, append, clear). SleekStack and React render the identical table.
 * jsdom timings are not browser timings: read the ratio to React only.
 *
 * Operations that destroy their own starting state (create, remove, append, clear) are measured as a pair with the restoring
 * step, so each iteration starts from the same table: the timing includes both steps, for both libraries.
 */
import { Atom, makeAtomStore } from '@sleekstack/core'
import { mount, useAtomValue } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Effect, Layer } from 'effect'
import { createElement as h, memo, useState } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { bench, describe } from 'vitest'
import { qwikApp } from './jsfb.qwik'
import { solidApp } from './jsfb.solid'
import { type App, clickCell, type Row, tick } from './jsfb-shared'
import { check } from './scenarios'

// The suite's label generator (adjective colour noun), seeded so both libraries get the same rows.
const ADJECTIVES = ['pretty', 'large', 'big', 'small', 'tall', 'short', 'long', 'handsome', 'plain', 'quaint', 'clean']
const COLOURS = ['red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'orange', 'white', 'black', 'gray']
const NOUNS = ['table', 'chair', 'house', 'bbq', 'desk', 'car', 'pony', 'cookie', 'sandwich', 'burger', 'pizza']
const makeData = () => {
  let id = 1
  let seed = 42
  const pick = (xs: ReadonlyArray<string>) => xs[(seed = (seed * 1103515245 + 12345) & 0x7fffffff) % xs.length]!
  return (count: number): Array<Row> =>
    Array.from({ length: count }, () => ({ id: id++, label: `${pick(ADJECTIVES)} ${pick(COLOURS)} ${pick(NOUNS)}` }))
}

// ---- SleekStack ----

const Tr = ({
  item,
  selected,
  onSelect,
  onRemove,
}: {
  item: Row
  selected: boolean
  onSelect: (id: number) => Effect.Effect<void>
  onRemove: (id: number) => Effect.Effect<void>
}) =>
  jsx('tr', {
    className: selected ? 'danger' : '',
    children: [
      jsx('td', { className: 'col-md-1', children: item.id }),
      jsx('td', {
        className: 'col-md-4',
        children: jsx('a', { onClick: () => onSelect(item.id), children: item.label }),
      }),
      jsx('td', {
        className: 'col-md-1',
        children: jsx('a', {
          onClick: () => onRemove(item.id),
          children: jsx('span', { className: 'glyphicon glyphicon-remove', 'aria-hidden': 'true' }),
        }),
      }),
      jsx('td', { className: 'col-md-6' }),
    ],
  })

const sleekApp = async (): Promise<App> => {
  const container = document.createElement('div')
  const store = makeAtomStore()
  const data = Atom.make<ReadonlyArray<Row>>([])
  const selected = Atom.make<number | null>(null)
  const onSelect = (id: number) => Effect.sync(() => store.set(selected, id))
  const onRemove = (id: number) => Effect.sync(() => store.update(data, (rows) => rows.filter((r) => r.id !== id)))
  const Table = () =>
    Effect.flatMap(Effect.all([useAtomValue(data), useAtomValue(selected)]), ([rows, sel]) =>
      jsx('table', {
        className: 'table table-hover table-striped test-data',
        children: jsx('tbody', {
          children: rows.map((item) =>
            jsx(Tr as any, { key: item.id, item, selected: sel === item.id, onSelect, onRemove }),
          ),
        }),
      }),
    )
  await mount(jsx(Table as any, {}), { layer: Layer.empty, container, store })
  return {
    container,
    set: async (rows) => (store.set(data, rows), void (await tick())),
    get: () => store.get(data),
    click: async (i, cell) => (clickCell(container, i, cell), void (await tick())),
  }
}

// ---- React (the reference implementation's shape: memoized row, handlers passed down) ----

const ReactRow = memo(function ReactRow({
  item,
  selected,
  onSelect,
  onRemove,
}: {
  item: Row
  selected: boolean
  onSelect: (id: number) => void
  onRemove: (id: number) => void
}) {
  return h(
    'tr',
    { className: selected ? 'danger' : '' },
    h('td', { className: 'col-md-1' }, item.id),
    h('td', { className: 'col-md-4' }, h('a', { onClick: () => onSelect(item.id) }, item.label)),
    h(
      'td',
      { className: 'col-md-1' },
      h(
        'a',
        { onClick: () => onRemove(item.id) },
        h('span', { className: 'glyphicon glyphicon-remove', 'aria-hidden': 'true' }),
      ),
    ),
    h('td', { className: 'col-md-6' }),
  )
})

const reactApp = (): App => {
  const container = document.createElement('div')
  let setRows!: (rows: ReadonlyArray<Row>) => void
  let current: ReadonlyArray<Row> = []
  const Table = () => {
    const [rows, setR] = useState<ReadonlyArray<Row>>([])
    const [sel, setSel] = useState<number | null>(null)
    setRows = (next) => ((current = next), setR(next))
    const onSelect = (id: number) => setSel(id)
    const onRemove = (id: number) => setRows(current.filter((r) => r.id !== id))
    return h(
      'table',
      { className: 'table table-hover table-striped test-data' },
      h(
        'tbody',
        null,
        rows.map((item) => h(ReactRow, { key: item.id, item, selected: sel === item.id, onSelect, onRemove })),
      ),
    )
  }
  flushSync(() => createRoot(container).render(h(Table)))
  return {
    container,
    set: async (rows) => void flushSync(() => setRows(rows)),
    get: () => current,
    click: async (i, cell) => void flushSync(() => clickCell(container, i, cell)),
  }
}

// ---- the operations ----

interface Op {
  name: string
  /** Rows the table holds before each iteration, and after it (the restoring step is part of the iteration when they differ). */
  run: (app: App, data: (n: number) => Array<Row>, base: ReadonlyArray<Row>, n: number) => Promise<void>
  /** Starting table size. */
  start: number
  /** vitest-bench iteration limits for slow operations. */
  slow?: boolean
}

const swapRows = (rows: ReadonlyArray<Row>, a: number, b: number) => {
  const out = [...rows]
  ;[out[a], out[b]] = [out[b]!, out[a]!]
  return out
}

const ops: ReadonlyArray<Op> = [
  // create: from an empty table (the clear that restores it is part of the iteration)
  { name: 'create-1k', start: 0, run: async (a, data) => (await a.set([]), a.set(data(1000))) },
  { name: 'replace-1k', start: 1000, run: (a, data) => a.set(data(1000)) },
  {
    name: 'update-every-10th',
    start: 1000,
    run: (a) => a.set(a.get().map((r, i) => (i % 10 === 0 ? { ...r, label: r.label + ' !!!' } : r))),
  },
  // alternates between two rows: selecting the selected row again changes nothing
  { name: 'select-row', start: 1000, run: (a, _d, _b, n) => a.click(1 + (n % 2), 2) },
  { name: 'swap-rows', start: 1000, run: (a) => a.set(swapRows(a.get(), 1, 998)) },
  // remove: restored by writing the base table back (one row is created again)
  { name: 'remove-row', start: 1000, run: async (a, _d, base) => (await a.click(4, 3), a.set(base)) },
  { name: 'create-10k', start: 0, slow: true, run: async (a, data) => (await a.set([]), a.set(data(10000))) },
  {
    name: 'append-1k',
    start: 1000,
    run: async (a, data, base) => (await a.set([...a.get(), ...data(1000)]), a.set(base)),
  },
  { name: 'clear-1k', start: 1000, run: async (a, data, base) => (await a.set([]), a.set(base)) },
]

const gc = (globalThis as { gc?: () => void }).gc
const settledText = (app: App) => `${app.container.querySelectorAll('tbody tr').length}:${app.container.textContent}`

const instance = async (make: () => Promise<App> | App, op: Op) => {
  const app = await make()
  const data = makeData()
  const base = data(op.start)
  if (op.start > 0) await app.set(base)
  let n = 0
  return { app, data, base, run: () => op.run(app, data, base, n++) }
}

for (const op of ops) {
  const caseName = `jsfb/${op.name}`
  const libs = {
    sleekstack: sleekApp,
    react: async () => reactApp(),
    solid: async () => solidApp(),
    qwik: qwikApp,
  } as const
  // A fresh table per library for the check, so the measured tables start from setup state.
  const checked = await Promise.all(
    Object.entries(libs).map(async ([lib, make]) => [lib, await instance(make, op)] as const),
  )
  await check(
    caseName,
    checked.map(
      ([lib, i]) =>
        [lib as 'sleekstack' | 'react' | 'solid' | 'qwik', async () => (await i.run(), settledText(i.app))] as const,
    ),
  )
  for (const [, i] of checked) i.app.dispose?.()
  describe(caseName, () => {
    for (const [lib, make] of Object.entries(libs)) {
      // Built when the benchmark starts and dropped when it ends: one table alive at a time keeps GC out of the numbers.
      let current: Awaited<ReturnType<typeof instance>> | undefined
      bench(lib, async () => void (await current!.run()), {
        ...(op.slow ? { iterations: 5, warmupIterations: 1, time: 0, warmupTime: 0 } : { time: 2000 }),
        setup: async () => {
          current = await instance(make, op)
          gc?.()
        },
        teardown: () => {
          current?.app.dispose?.()
          current = undefined
        },
      })
    }
  })
}
