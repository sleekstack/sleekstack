import * as path from 'node:path'
import { buildGraph, snapshot as coreSnapshot } from '@sleekstack/core'
import { snapshot as kitSnapshot } from '@sleekstack/kit'
import { describe, expect, it } from 'vitest'
import { analyze } from '../index'
import * as coreApp from './fixtures/core-app/app'
import * as kitApp from './fixtures/kit-app/app'

const fixture = (name: string) => analyze({ project: path.join(__dirname, 'fixtures', name, 'tsconfig.json') })
const byId = <T extends { id: string }>(xs: readonly T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id))
const edgeKey = (xs: readonly { from: string; to: string; tag: string }[]) => xs.map((e) => `${e.from}->${e.to}:${e.tag}`).sort()
const shape = (g: { nodes: readonly { id: string }[]; edges: readonly { from: string; to: string; tag: string }[]; shadowing: readonly unknown[] }) => ({
  nodes: byId(g.nodes),
  edges: edgeKey(g.edges),
  shadowing: g.shadowing,
})

describe('analyze', () => {
  it('kit fixture: same graph as kit snapshot, plus atom and effect edges', () => {
    const r = fixture('kit-app')
    expect(r.errors).toEqual([])
    expect(r.graphs).toHaveLength(1)
    const g = r.graphs[0]!
    expect(shape(g)).toEqual(shape(kitSnapshot(kitApp.App)))
    expect(g.private).toEqual(expect.arrayContaining(['Store']))
    expect(g.modules.find((m) => m.name === 'Infra')?.exports).toEqual(['Clock', 'Logger'])
    expect(edgeKey(r.atoms.edges)).toEqual(['atom:count->Clock:Clock', 'atom:doubled->Clock:Clock'])
    expect(edgeKey(g.edges)).toEqual(expect.arrayContaining(['effect:boot->Logger:Logger', 'effect:boot->TaskRepo:TaskRepo']))
  })

  it('core fixture: same graph as core snapshot(buildGraph)', () => {
    const r = fixture('core-app')
    expect(r.errors).toEqual([])
    expect(shape(r.graphs[0]!)).toEqual(shape(coreSnapshot(buildGraph([coreApp.App]))))
  })

  it('reports computed and unresolvable declarations with file:line', () => {
    const r = fixture('errors')
    expect(r.errors.map(({ code, file, line }) => ({ code, file, line }))).toEqual([
      { code: 'Computed', file: 'app.ts', line: 10 },
      { code: 'Unresolvable', file: 'app.ts', line: 11 },
      { code: 'Computed', file: 'app.ts', line: 16 },
      { code: 'Computed', file: 'app.ts', line: 21 },
      { code: 'UnnamedEffect', file: 'app.ts', line: 22 },
    ])
  })
})
