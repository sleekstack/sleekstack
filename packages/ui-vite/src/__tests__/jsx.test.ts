import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { build, type Rolldown } from 'vite'
import { describe, expect, it } from 'vitest'
import { sleekstack } from '../index'

const root = fileURLToPath(new URL('./fixtures/jsx', import.meta.url))
const entries = { ui: 'ui.tsx', guest: 'guest.tsx', counter: 'islands/counter.tsx', legacy: 'islands/legacy.tsx' }

// One fixture build with `sleekstack()` beside plugin-react; the runtimes stay external so each chunk shows which one it imports.
const runtimes = async () => {
  const out = (await build({
    root,
    logLevel: 'silent',
    configFile: false,
    plugins: [react(), sleekstack({ include: 'islands/**', exclude: 'islands/legacy.tsx' })],
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: Object.fromEntries(Object.entries(entries).map(([k, f]) => [k, `${root}/${f}`])),
        external: [/^react/, /^@sleekstack\//],
        output: { entryFileNames: '[name].js' },
        preserveEntrySignatures: 'exports-only',
      },
    },
  })) as Rolldown.RolldownOutput
  return Object.fromEntries(
    out.output.flatMap((c) =>
      c.type === 'chunk' ? [[c.name, c.code.match(/from "([^"]+)\/jsx-(?:dev-)?runtime"/)?.[1]]] : [],
    ),
  )
}

describe('sleekstack() JSX', () => {
  it('compiles pragma ui TSX, include-matched TSX and React guest TSX side by side; others keep the default', async () => {
    expect(await runtimes()).toEqual({
      ui: '@sleekstack/ui',
      counter: '@sleekstack/ui',
      guest: 'react',
      legacy: 'react',
    })
  })
})
