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
import { check, rowIds, sleekTree } from './scenarios'

const gc = (globalThis as { gc?: () => void }).gc
const opts = { setup: () => gc?.() }

const Row = ({ i }: { i: number }) => h('li', { className: 'row' }, `Item ${i}`)
const reactTree = (first?: () => unknown) => h('ul', null, rowIds.map((i) => (i === 0 && first ? h(first as any, { key: i }) : h(Row, { key: i, i }))))

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
const sleekU = await sleekUpdate()
const reactU = reactUpdate()
await check('render-dom/update-1-of-1k', [
  ['sleekstack', sleekU.run],
  ['react', reactU.run],
])
const nodeSwaps = { sleekstack: await swaps(sleekU), react: await swaps(reactU) }
console.log('render-dom/update-1-of-1k node swaps per update:', nodeSwaps)
const results = resolve(import.meta.dirname, '../results')
mkdirSync(results, { recursive: true })
writeFileSync(resolve(results, 'swaps.json'), JSON.stringify({ 'render-dom/update-1-of-1k': nodeSwaps }, null, 2))

describe('render-dom/mount-1k', () => {
  bench('sleekstack', async () => void (await sleekMount()), opts)
  bench('react', () => void reactMount(), opts)
})

describe('render-dom/update-1-of-1k', () => {
  bench('sleekstack', async () => void (await sleekU.run()), opts)
  bench('react', () => void reactU.run(), opts)
})
