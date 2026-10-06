// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import type { QueryClient } from '@tanstack/query-core'
import { Cause, Data, Effect, Layer, Scope } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Boundary, el, mount, type Mounted, Pending, useAtomValue, useLocal } from '@sleekstack/ui'
import { useQuery, useQueryClient, UiQueryClientLive } from '../ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { RenderScope as Scoped } from '@sleekstack/ui/internal'

const jsx = (type: any, props: any, key?: string) => rawJsx(type, props, key)
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

// A promise the test settles.
const gate = () => {
  let open!: () => void
  const promise = new Promise<void>((r) => (open = r))
  return { promise, open: () => act(async () => (open(), await new Promise((r) => setTimeout(r, 0)))) }
}

// Registers a finalizer on the running RenderScope; flips `flag.closed` when that scope closes.
const onClose = (flag: { closed: boolean }) =>
  Effect.flatMap(Scoped, (s) =>
    s
      ? Scope.addFinalizer(
          s,
          Effect.sync(() => void (flag.closed = true)),
        )
      : Effect.void,
  )

let handles: Array<Mounted> = []
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  await act(async () => {
    for (const h of handles) await h.dispose()
  })
  handles = []
})
const go = async (app: any, layer: unknown = Layer.empty) => {
  const container = document.createElement('div')
  const store = makeAtomStore()
  const errors: Array<Cause.Cause<unknown>> = []
  await act(
    async () =>
      void handles.push(
        await mount(app, { layer, container, store, onError: (c: Cause.Cause<unknown>) => errors.push(c) } as any),
      ),
  )
  return { container, store, errors }
}

class Boom extends Data.TaggedError('Boom')<{}> {}

// Content reading query `key` (resolved at once) after waiting on `wait`; `client` and `observers()` inspect the cache.
const queried = (key: string) => {
  let client: QueryClient | undefined
  const Q = () =>
    Effect.flatMap(
      useQueryClient(),
      (c) => (
        (client = c),
        Effect.map(useQuery({ queryKey: [key], queryFn: async () => 'q', retry: false }), (r) =>
          el('b', {}, r.data ?? '-'),
        )
      ),
    )
  const observers = () =>
    client
      ?.getQueryCache()
      .find({ queryKey: [key] })
      ?.getObserversCount() ?? 0
  return { Q, observers }
}

describe('Pending with queries', () => {
  it('R2: a re-run keeps the old content (never the fallback); its observer is retained until the new content commits', async () => {
    const parent = Atom.make(0)
    const gates = [gate(), gate()]
    let forks = 0
    const { Q, observers } = queried('r2')
    const Parent = () =>
      Effect.flatMap(useAtomValue(parent), (p) =>
        jsx('div', {
          children: [
            String(p),
            jsx(Pending, {
              fallback: 'loading',
              children: Effect.suspend(() =>
                Effect.zipRight(
                  Effect.promise(() => gates[forks++]!.promise),
                  jsx(Q, {}),
                ),
              ),
            }),
          ],
        }),
      )
    const { container, store } = await go(jsx(Parent, {}), UiQueryClientLive())
    await gates[0]!.open()
    await tick()
    expect(container.textContent).toBe('0q')
    expect(observers()).toBe(1)
    store.set(parent, 1)
    await tick()
    expect(container.textContent).toBe('1q')
    expect(observers()).toBe(1)
    await gates[1]!.open()
    await tick()
    expect(container.textContent).toBe('1q')
    // The old observer released at commit; only the new content's remains.
    expect(observers()).toBe(1)
    expect(forks).toBe(2)
  })

  it('R2: a failed re-run keeps the old content and reports', async () => {
    const parent = Atom.make(0)
    const Parent = () =>
      Effect.flatMap(useAtomValue(parent), (p) =>
        jsx(Pending, {
          fallback: 'loading',
          children: p === 0 ? Effect.succeed(el('b', {}, 'ok')) : Effect.fail(new Boom()),
        }),
      )
    const { container, store, errors } = await go(jsx(Parent, {}))
    await tick()
    expect(container.textContent).toBe('ok')
    store.set(parent, 1)
    await tick()
    expect(container.textContent).toBe('ok')
    expect(errors.length).toBe(1)
  })

  it.each(['unmount', 'supersede'])(
    'R3: %s while pending interrupts the fiber, closes scopes and leaks no observer',
    async (how) => {
      const show = Atom.make(0)
      const gates = [gate(), gate()]
      let forks = 0
      const interrupted: Array<number> = []
      const scope = { closed: false }
      const { Q, observers } = queried(`r3-${how}`)
      // The first fork subscribes its observer, then waits; later forks resolve once their gate opens.
      const content = Effect.suspend(() => {
        const n = forks++
        const wait = Effect.onInterrupt(
          Effect.promise(() => gates[n]!.promise),
          () => Effect.sync(() => void interrupted.push(n)),
        )
        return n === 0
          ? Effect.zipRight(
              onClose(scope),
              jsx('div', { children: [jsx(Q, {}), Effect.zipRight(wait, Effect.succeed(el('i', {}, 'x')))] }),
            )
          : Effect.zipRight(wait, Effect.succeed(el('b', {}, 'new')))
      })
      const Parent = () =>
        Effect.flatMap(useAtomValue(show), (s) =>
          s === 1 && how === 'unmount'
            ? Effect.succeed(el('p', {}, 'off'))
            : jsx(Pending, { fallback: `loading${s}`, children: content }),
        )
      const { container, store } = await go(jsx(Parent, {}), UiQueryClientLive())
      await tick()
      expect(observers()).toBe(1)
      store.set(show, 1)
      await tick()
      expect(interrupted).toEqual([0])
      expect(scope.closed).toBe(true)
      expect(observers()).toBe(0)
      // Latest wins: the stale gate opening writes nothing.
      await gates[0]!.open()
      expect(container.textContent).toBe(how === 'unmount' ? 'off' : 'loading1')
      if (how === 'supersede') {
        await gates[1]!.open()
        await tick()
        expect(container.textContent).toBe('new')
      }
    },
  )
})
