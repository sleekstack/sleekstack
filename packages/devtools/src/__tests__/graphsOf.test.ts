import { describe, expect, it } from 'vitest'
import { graphsOf } from '../graph/graphsOf'

const g = { nodes: [{ id: 'a', name: 'Db', lifetime: 'app' }], edges: [] }

describe('graphsOf', () => {
  it('keeps every root with its kind, app first, and an unknown kind as a plain root', () => {
    const roots = graphsOf({
      runtimes: [
        { kind: 'app', graph: { ...g, root: 'App' } },
        { kind: 'request', graph: { ...g, root: 'RequestLive' } },
        { kind: 'overrides', graph: { ...g, root: 'DemoLive' } },
        { kind: 'opaque', graph: { ...g, root: 'x.ts:3' } },
        { kind: 'future', graph: { ...g, root: 'Later' } },
      ],
    })
    expect(roots.map((r) => [r.root, r.kind])).toEqual([
      ['App', 'app'], ['RequestLive', 'request'], ['DemoLive', 'overrides'], ['x.ts:3', 'opaque'], ['Later', undefined],
    ])
  })

  it('prefers kind-carrying roots over a bare graphs list in the CLI envelope', () => {
    const roots = graphsOf({ graphs: [g], roots: [{ kind: 'request', graph: { ...g, root: 'RequestLive' } }] })
    expect(roots.map((r) => [r.root, r.kind])).toEqual([['RequestLive', 'request']])
  })
})
