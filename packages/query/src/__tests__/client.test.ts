import { describe, expect, it, vi } from 'vitest'
import { Context, Data, Effect, Exit, Layer, Scope } from 'effect'
import { MutationObserver, QueryClient } from '@tanstack/query-core'
import { effectFn, QueryClientLive, QueryClientTag } from '../index'

class Greeting extends Context.Tag('Greeting')<Greeting, string>() {}
class Boom extends Data.TaggedError('Boom')<{ n: number }> {}

/** Builds the layer (with `Greeting` provided) in a fresh scope. */
const build = async (layer = QueryClientLive()) => {
  const scope = Effect.runSync(Scope.make())
  const ctx = await Effect.runPromise(Layer.buildWithScope(Layer.provide(layer, Layer.succeed(Greeting, 'hi')), scope))
  return { client: Context.get(ctx, QueryClientTag), close: () => Effect.runPromise(Scope.close(scope, Exit.void)) }
}

describe('QueryClientLive', () => {
  it('mounts while open, unmounts and clears on close', async () => {
    const calls: string[] = []
    const spies = (['mount', 'unmount', 'clear'] as const).map((m) => {
      const orig = QueryClient.prototype[m]
      return vi.spyOn(QueryClient.prototype, m).mockImplementation(function (this: QueryClient) { calls.push(m); orig.call(this) })
    })
    try {
      const { client, close } = await build()
      client.setQueryData(['k'], 1)
      expect(calls).toEqual(['mount'])
      await close()
      expect(calls).toEqual(['mount', 'unmount', 'clear'])
      expect(client.getQueryCache().getAll()).toHaveLength(0)
    } finally {
      spies.forEach((s) => s.mockRestore())
    }
  })

  it('a throwing config function fails the layer with the original error', async () => {
    const err = new Error('bad config')
    const exit = await Effect.runPromiseExit(Effect.scoped(Layer.build(QueryClientLive(() => { throw err }))))
    expect(exit).toEqual(Exit.fail(err))
  })
})

describe('effectFn', () => {
  const run = async <A>(fn: (ctx: { client: QueryClient; signal?: AbortSignal }) => Promise<A>, signal?: AbortSignal) => {
    const { client, close } = await build()
    try { return await fn({ client, signal }) } finally { await close() }
  }

  it('resolves with the success value using the layer services', async () => {
    await expect(run(effectFn(Effect.map(Greeting, (g) => `${g}!`)))).resolves.toBe('hi!')
  })

  it('rejects with the original tagged error', async () => {
    const e = await run(effectFn(Effect.fail(new Boom({ n: 1 })))).catch((x) => x)
    expect(e).toBeInstanceOf(Boom)
    expect(e.n).toBe(1)
  })

  it('rejects with a defect', async () => {
    const d = new Error('defect')
    await expect(run(effectFn(Effect.die(d)))).rejects.toBe(d)
  })

  it('interrupts on abort', async () => {
    const ac = new AbortController()
    let interrupted = false
    const fn = effectFn(Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => { interrupted = true }))))
    const p = run(fn, ac.signal)
    setTimeout(() => ac.abort(), 5)
    await expect(p).rejects.toBeDefined()
    expect(interrupted).toBe(true)
  })

  it('a pre-aborted signal never runs the effect', async () => {
    const ac = new AbortController()
    ac.abort()
    let ran = false
    await expect(run(effectFn(Effect.sync(() => { ran = true })), ac.signal)).rejects.toBeDefined()
    expect(ran).toBe(false)
  })

  it('works as a mutationFn with layer services', async () => {
    const { client, close } = await build()
    try {
      const m = new MutationObserver(client, { mutationFn: effectFn(Greeting) })
      await expect(m.mutate(undefined)).resolves.toBe('hi')
    } finally { await close() }
  })

  it('a missing Tag rejects with the standard missing-dependency error', async () => {
    class Missing extends Context.Tag('Missing')<Missing, number>() {}
    await expect(run(effectFn(Missing))).rejects.toThrow(/Service not found: Missing/)
  })

  it('works as a queryFn through fetchQuery', async () => {
    await expect(run(({ client }) => client.fetchQuery({ queryKey: ['g'], queryFn: effectFn(Greeting) }))).resolves.toBe('hi')
  })
})
