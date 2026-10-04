// Cost of the component instance wrapper `jsx()` adds (fn-19): the same tree rendered through `jsx` versus with every
// function component called directly. `direct` is the in-suite reference the ratio gate divides by.
import { Atom } from '@sleekstack/core'
import { renderToString, useAtomValue } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Effect, Layer } from 'effect'
import { bench, describe } from 'vitest'
import { check, sleekTree } from './scenarios'

const direct = (type: any, props: any) => (typeof type === 'function' ? type(props) : jsx(type, props))

const count = Atom.make(0)
const Counter = () => Effect.flatMap(useAtomValue(count), (n) => jsx('li', { className: 'row', children: `Item ${n}` }))

const cases = {
  'jsx-overhead/non-reactive-1k': (j: typeof jsx) => () => renderToString(sleekTree(j), { layer: Layer.empty }),
  'jsx-overhead/one-reactive-1k': (j: typeof jsx) => () => renderToString(sleekTree(j, Counter), { layer: Layer.empty }),
}

for (const [name, make] of Object.entries(cases)) {
  const wrapped = make(jsx)
  const plain = make(direct)
  // fn-25 hydration markers (wrappers, text separators) only exist on the `jsx` path; compare the markup without them.
  const bare = (body: () => Promise<unknown>) => async () =>
    String(await body()).replace(/<\/?sleek-(?:reactive|guest)[^>]*>|<!--sleek-t-->/g, '')
  await check(name, [
    ['sleekstack', bare(wrapped)],
    ['direct', bare(plain)],
  ])
  describe(name, () => {
    bench('sleekstack', async () => void (await wrapped()))
    bench('direct', async () => void (await plain()))
  })
}
