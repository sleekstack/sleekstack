// @vitest-environment jsdom
import { Component, Suspense, type ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect, Cause, Option } from 'effect'
import { Atom as CoreAtom, atomStoreFor, buildGraph, makeAppScope, Result } from '@sleekstack/core'
import { atom, layer, module, tag, type Atom, type SleekStackError } from '../index'
import { LayerProvider, useAtomValue, useService } from '../react'
import { action, configureRuntime } from '../next'
import { normalize } from '../errors'
import { coreTag } from '../tag'
import { unwrap } from '../module'

afterEach(cleanup)

const Dep = tag<number>('Dep')
const Lib = module({ name: 'Lib', provide: [layer(Dep, 1)], exports: [] })

let caught: unknown
class Boundary extends Component<{ children: ReactNode }, { error?: unknown }> {
  state: { error?: unknown } = {}
  static getDerivedStateFromError(error: unknown) { caught = error; return { error } }
  render() { return this.state.error ? null : this.props.children }
}
const inReact = async (el: ReactNode, provide: never) => {
  caught = undefined
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<Boundary><Suspense fallback={null}><LayerProvider provide={provide}>{el}</LayerProvider></Suspense></Boundary>)
  await vi.waitFor(() => expect(caught).toBeDefined())
  vi.restoreAllMocks()
  return caught as SleekStackError
}

const UseService = () => <>{useService(Dep)}</>
const ReadAtom = ({ a }: { a: Atom<unknown> }) => <>{String(useAtomValue(a))}</>

const boundaries: Record<string, (provide: never) => Promise<SleekStackError>> = {
  useService: (p) => inReact(<UseService />, p),
  'kit atoms': (p) => inReact(<ReadAtom a={atom((d) => d, [Dep])} />, p),
  'kit next': async (p) => {
    configureRuntime({ provide: p })
    return action((d) => () => d, [Dep])().then(() => { throw new Error('resolved') }, (e) => e)
  },
  AtomStore: async (p) => {
    const app = await Effect.runPromise(makeAppScope(buildGraph(unwrap(p))))
    const r = atomStoreFor(app).get(CoreAtom.make(Effect.gen(function* () { return yield* coreTag(Dep) })))
    return normalize(Result.isFailure(r) ? Option.getOrThrow(Cause.failureOption(r.cause)) : 'no failure')
  },
}

describe('every boundary gives the canonical resolution failure', () => {
  describe.each(Object.entries(boundaries))('%s', (_, run) => {
    it('missing -> MissingDependency', async () => {
      const e = await run([] as never)
      expect(e).toMatchObject({ name: 'SleekStackError', code: 'MissingDependency', details: { tag: 'Dep', missing: 'Dep' } })
      expect(e.message).toBe(`"${e.details.service}" requires "Dep", which is not provided`)
    })
    it('private -> PrivateDependency', async () => {
      const e = await run([Lib] as never)
      expect(e).toMatchObject({ name: 'SleekStackError', code: 'PrivateDependency', details: { tag: 'Dep', module: 'Lib' } })
      expect(e.message).toBe(`"${e.details.requiredBy}" requires "Dep", which is private to module "Lib" (not in its exports)`)
    })
  })
})
