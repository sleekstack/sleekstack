import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyze } from '../index'

const fixture = (name: string) => analyze({ project: path.join(__dirname, 'fixtures', name, 'tsconfig.json') })
const byId = <T extends { id: string }>(xs: readonly T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id))
const edgeKey = (xs: readonly { from: string; to: string; tag: string }[]) =>
  xs.map((e) => `${e.from}->${e.to}:${e.tag}`).sort()
const shape = (g: {
  nodes: readonly { id: string }[]
  edges: readonly { from: string; to: string; tag: string }[]
  shadowing: readonly unknown[]
}) => ({
  nodes: byId(g.nodes),
  edges: edgeKey(g.edges),
  shadowing: g.shadowing,
})

describe('analyze', () => {
  it('core fixture: clean graph, privacy and edges', () => {
    const r = fixture('core-app')
    expect(r.errors).toEqual([])
    expect(r.graphs).toHaveLength(1)
    const g = r.graphs[0]!
    expect(g.private).toEqual(expect.arrayContaining(['Store']))
    expect(g.modules.find((m) => m.name === 'Infra')?.exports).toEqual(['Clock', 'Logger'])
    expect(shape(g).edges).toEqual(expect.arrayContaining(['Logger->Clock:Clock', 'Store->Logger:Logger']))
  })

  it('reports computed and unresolvable declarations with file:line', () => {
    const r = fixture('errors')
    expect(r.errors.map(({ code, file, line }) => ({ code, file, line }))).toEqual([
      { code: 'Computed', file: 'app.ts', line: 10 },
      { code: 'Unresolvable', file: 'app.ts', line: 11 },
      { code: 'Computed', file: 'app.ts', line: 16 },
      { code: 'Computed', file: 'app.ts', line: 21 },
    ])
  })
})
