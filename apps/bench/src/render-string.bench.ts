import { renderToString } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Layer } from 'effect'
import { createElement as h } from 'react'
import { renderToString as reactRenderToString } from 'react-dom/server'
import { bench, describe } from 'vitest'
import { check, rowIds } from './scenarios'
import { sleekTree } from './scenarios'

const Row = ({ i }: { i: number }) => h('li', { className: 'row' }, `Item ${i}`)
const reactTree = () =>
  h(
    'ul',
    null,
    rowIds.map((i) => h(Row, { key: i, i })),
  )

const sleekstack = () => renderToString(sleekTree(jsx), { layer: Layer.empty })
const react = () => reactRenderToString(reactTree())

await check('render-string/list-1k', [
  ['sleekstack', sleekstack],
  ['react', react],
])

describe('render-string/list-1k', () => {
  bench('sleekstack', async () => void (await sleekstack()))
  bench('react', () => void react())
})
