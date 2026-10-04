// @vitest-environment jsdom
// jsdom timings are not browser timings: read these numbers relative to React in the same run only.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Atom, makeAtomStore } from '@sleekstack/core'
import { mount, useAtomValue } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Effect, Layer } from 'effect'
import { createElement as h, useState } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { bench, describe } from 'vitest'
import { check, dataRuns, itemsAfter, ROWS, rowIds, rowLabel, sleekDataTree, sleekTree, type Item, type TreeOptions } from './scenarios'

const gc = (globalThis as { gc?: () => void }).gc
const opts = { setup: () => gc?.() }

const Row = ({ i, label }: { i: number; label: (i: number) => string }) => h('li', { className: 'row' }, label(i))
const reactTree = (first?: () => unknown, { ids = rowIds, label = rowLabel }: TreeOptions = {}) =>
  h('ul', null, ids.map((i) => (i === 0 && first ? h(first as any, { key: i }) : h(Row, { key: i, i, label }))))

// ---- first mount (+ unmount, so every iteration starts from an empty container) ----

const sleekMount = async () => {
  const container = document.createElement('div')
  const m = await mount(sleekTree(jsx), { layer: Layer.empty, container })
  const text = container.textContent
  await m.dispose()
  return text
}
const reactMount = () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  flushSync(() => root.render(reactTree()))
  const text = container.textContent
  root.unmount()
  return text
}

await check('render-dom/mount-1k', [
  ['sleekstack', sleekMount],
  ['react', reactMount],
])

// ---- reactive update: one row reads state, one write re-renders that row only ----

// The re-run is scheduled on a microtask and forked as an Effect fiber; it commits one microtask turn later (two awaited for margin).
const settle = async () => {
  for (let i = 0; i < 2; i++) await Promise.resolve()
}

const sleekUpdate = async () => {
  const container = document.createElement('div')
  const store = makeAtomStore()
  const count = Atom.make(0)
  const Counter = () => Effect.flatMap(useAtomValue(count), (n) => jsx('li', { className: 'row', children: `Item ${n}` }))
  await mount(sleekTree(jsx, Counter), { layer: Layer.empty, container, store })
  let n = 0
  return { container, run: async () => (store.set(count, ++n), await settle(), container.textContent) }
}
const reactUpdate = () => {
  const container = document.createElement('div')
  let set!: (n: number) => void
  const Counter = () => {
    const [n, s] = useState(0)
    set = s
    return h('li', { className: 'row' }, `Item ${n}`)
  }
  flushSync(() => createRoot(container).render(reactTree(Counter)))
  let n = 0
  return { container, run: () => (flushSync(() => set(++n)), container.textContent) }
}

// Node swaps per update, counted outside measurement with a MutationObserver.
const swaps = async (u: { container: Element; run: () => unknown }) => {
  let count = 0
  const obs = new MutationObserver((rs) => rs.forEach((r) => (count += r.addedNodes.length + r.removedNodes.length)))
  obs.observe(u.container, { childList: true, subtree: true, characterData: true })
  await u.run()
  await settle()
  for (const r of obs.takeRecords()) count += r.addedNodes.length + r.removedNodes.length
  obs.disconnect()
  return count
}
// ---- keyed list: one state write re-renders the whole keyed list; the reconciler should touch only what changed ----

/** Keyed-list state per write count `n`. */
type Step = (n: number) => TreeOptions
const SWAP_A = 1
const SWAP_B = ROWS - 2
/** Swaps rows 1 and 998 on odd writes, restores on even ones. */
const reorder: Step = (n) => {
  if (n % 2 === 0) return {}
  const ids = [...rowIds]
  ;[ids[SWAP_A], ids[SWAP_B]] = [ids[SWAP_B]!, ids[SWAP_A]!]
  return { ids }
}
/** Relabels row 500 only. */
const relabel: Step = (n) => ({ label: (i) => (i === 500 ? `Item ${i} #${n}` : rowLabel(i)) })

// A whole-list re-render commits after Effect's scheduler yields to a macrotask, so this case's time includes one timer turn.
const tick = () => new Promise((r) => setTimeout(r, 0))
const sleekKeyed = async (step: Step) => {
  const container = document.createElement('div')
  const store = makeAtomStore()
  const state = Atom.make(0)
  const List = () => Effect.flatMap(useAtomValue(state), (n) => sleekTree(jsx, undefined, { keyed: true, ...step(n) }))
  await mount(jsx(List as any, {}), { layer: Layer.empty, container, store })
  let n = 0
  return { container, run: async () => (store.set(state, ++n), await tick(), container.textContent) }
}
const reactKeyed = (step: Step) => {
  const container = document.createElement('div')
  let set!: (n: number) => void
  const List = () => {
    const [n, s] = useState(0)
    set = s
    return reactTree(undefined, step(n))
  }
  flushSync(() => createRoot(container).render(h(List)))
  let n = 0
  return { container, run: () => (flushSync(() => set(++n)), container.textContent) }
}

// ---- keyed data list: rows take an item object (no fresh closure), one item object changes per write ----

const sleekKeyedData = async () => {
  const container = document.createElement('div')
  const store = makeAtomStore()
  const state = Atom.make(0)
  const List = () => Effect.flatMap(useAtomValue(state), (n) => sleekDataTree(jsx, itemsAfter(n)))
  await mount(jsx(List as any, {}), { layer: Layer.empty, container, store })
  let n = 0
  return { container, run: async () => (store.set(state, ++n), await tick(), container.textContent) }
}
const ReactDataRow = ({ item }: { item: Item }) => (dataRuns.react++, h('li', { className: 'row' }, item.label))
const reactKeyedData = () => {
  const container = document.createElement('div')
  let set!: (n: number) => void
  const List = () => {
    const [n, s] = useState(0)
    set = s
    return h('ul', null, itemsAfter(n).map((item) => h(ReactDataRow, { key: item.id, item })))
  }
  flushSync(() => createRoot(container).render(h(List)))
  let n = 0
  return { container, run: () => (flushSync(() => set(++n)), container.textContent) }
}

const sleekU = await sleekUpdate()
const reactU = reactUpdate()
await check('render-dom/update-1-of-1k', [
  ['sleekstack', sleekU.run],
  ['react', reactU.run],
])
const keyedReorder = { sleekstack: await sleekKeyed(reorder), react: reactKeyed(reorder) }
const keyedUpdate = { sleekstack: await sleekKeyed(relabel), react: reactKeyed(relabel) }
await check('render-dom/keyed-reorder-1k', [
  ['sleekstack', keyedReorder.sleekstack.run],
  ['react', keyedReorder.react.run],
])
await check('render-dom/keyed-update-1-of-1k', [
  ['sleekstack', keyedUpdate.sleekstack.run],
  ['react', keyedUpdate.react.run],
])

const keyedData = { sleekstack: await sleekKeyedData(), react: reactKeyedData() }
await check('render-dom/keyed-update-data-1-of-1k', [
  ['sleekstack', keyedData.sleekstack.run],
  ['react', keyedData.react.run],
])
// Row-component executions per update, counted outside measurement.
for (const lib of ['sleekstack', 'react'] as const) {
  dataRuns[lib] = 0
  await keyedData[lib].run()
  await settle()
  console.log(`render-dom/keyed-update-data-1-of-1k component runs per update (${lib}):`, dataRuns[lib])
}

const nodeSwaps: Record<string, Record<string, number>> = {}
for (const [name, u] of [
  ['render-dom/update-1-of-1k', { sleekstack: sleekU, react: reactU }],
  ['render-dom/keyed-reorder-1k', keyedReorder],
  ['render-dom/keyed-update-1-of-1k', keyedUpdate],
  ['render-dom/keyed-update-data-1-of-1k', keyedData],
] as const) {
  nodeSwaps[name] = { sleekstack: await swaps(u.sleekstack), react: await swaps(u.react) }
  console.log(`${name} node swaps per update:`, nodeSwaps[name])
}
const results = resolve(import.meta.dirname, '../results')
mkdirSync(results, { recursive: true })
writeFileSync(resolve(results, 'swaps.json'), JSON.stringify(nodeSwaps, null, 2))

describe('render-dom/mount-1k', () => {
  bench('sleekstack', async () => void (await sleekMount()), opts)
  bench('react', () => void reactMount(), opts)
})

describe('render-dom/update-1-of-1k', () => {
  bench('sleekstack', async () => void (await sleekU.run()), opts)
  bench('react', () => void reactU.run(), opts)
})

describe('render-dom/keyed-reorder-1k', () => {
  bench('sleekstack', async () => void (await keyedReorder.sleekstack.run()), opts)
  bench('react', () => void keyedReorder.react.run(), opts)
})

describe('render-dom/keyed-update-1-of-1k', () => {
  bench('sleekstack', async () => void (await keyedUpdate.sleekstack.run()), opts)
  bench('react', () => void keyedUpdate.react.run(), opts)
})

describe('render-dom/keyed-update-data-1-of-1k', () => {
  bench('sleekstack', async () => void (await keyedData.sleekstack.run()), opts)
  bench('react', () => void keyedData.react.run(), opts)
})
