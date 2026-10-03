import { describe, expect, it } from 'vitest'
import { Context, Deferred, Effect, Exit, Option } from 'effect'
import { makeAtomStore } from '@sleekstack/core'
import { Mutation, Queries, Query } from '../index'

const tick = () => new Promise((r) => setTimeout(r, 0))

const setup = () => {
  const store = makeAtomStore()
  const q = Query.make({ key: (id: string) => ['todo', id], fetch: () => Effect.succeed('server'), staleTime: '1 hour' })
  const client = Queries.make(store)
  client.setData(q('1'), 'base')
  const release = Query.observe(store, q('1'))
  return { store, q, client, release }
}

describe('Mutation', () => {
  it('rolls back an optimistic write on failure; overlapping rollbacks never wipe a later write', async () => {
    const { store, q, client } = setup()
    const gates = [0, 1].map(() => Effect.runSync(Deferred.make<void, string>()))
    const m = Mutation.make({
      run: (i: number) => Deferred.await(gates[i]!),
      onMutate: (i: number) => Mutation.optimistic(q('1'), () => `opt${i}`),
    })
    const r = Mutation.runner(store, m)
    const p0 = r.mutate(0)
    const p1 = r.mutate(1)
    await tick()
    expect(client.getData(q('1'))).toEqual(Option.some('opt1'))
    // the earlier call fails first: the later optimistic write survives
    Effect.runSync(Deferred.fail(gates[0]!, 'boom'))
    expect(Exit.isFailure(await p0)).toBe(true)
    expect(client.getData(q('1'))).toEqual(Option.some('opt1'))
    Effect.runSync(Deferred.fail(gates[1]!, 'boom'))
    await p1
    expect(client.getData(q('1'))).toEqual(Option.some('base'))
    expect(store.get(r.state)._tag).toBe('failure')
  })

  it('rolls back in reverse order when both fail latest-first', async () => {
    const { store, q, client } = setup()
    const order: number[] = []
    const gates = [0, 1].map(() => Effect.runSync(Deferred.make<void, string>()))
    const m = Mutation.make({
      run: (i: number) => Deferred.await(gates[i]!),
      onMutate: (i: number) => Effect.map(Mutation.optimistic(q('1'), () => `opt${i}`), (rb) => Effect.zipRight(Effect.sync(() => order.push(i)), rb)),
    })
    const r = Mutation.runner(store, m)
    const ps = [r.mutate(0), r.mutate(1)]
    await tick()
    Effect.runSync(Deferred.fail(gates[1]!, 'x'))
    await ps[1]
    expect(client.getData(q('1'))).toEqual(Option.some('opt0'))
    Effect.runSync(Deferred.fail(gates[0]!, 'x'))
    await ps[0]
    expect(order).toEqual([1, 0])
    expect(client.getData(q('1'))).toEqual(Option.some('base'))
  })

  it('an earlier failure after a later success keeps the later write', async () => {
    const { store, q, client } = setup()
    const gates = [0, 1].map(() => Effect.runSync(Deferred.make<void, string>()))
    const r = Mutation.runner(store, Mutation.make({
      run: (i: number) => Deferred.await(gates[i]!),
      onMutate: (i: number) => Mutation.optimistic(q('1'), () => `opt${i}`),
    }))
    const ps = [r.mutate(0), r.mutate(1)]
    await tick()
    Effect.runSync(Deferred.succeed(gates[1]!, undefined))
    await ps[1]
    Effect.runSync(Deferred.fail(gates[0]!, 'x'))
    await ps[0]
    expect(client.getData(q('1'))).toEqual(Option.some('opt1'))
  })

  it.each([
    ['onMutate fails after its optimistic write', 'fail'],
    ['switch interrupts during onSuccess', 'switch'],
  ] as const)('rolls back when %s', async (_, how) => {
    const { store, q, client } = setup()
    const r = Mutation.runner(store, Mutation.make({
      concurrency: 'switch',
      run: (_: number) => Effect.void,
      onMutate: (i: number) => Effect.tap(Mutation.optimistic(q('1'), (p) => `${Option.getOrElse(p, () => '')}+${i}`), () => (how === 'fail' ? Effect.fail('x') : Effect.void)),
      onSuccess: (_, i) => (i === 0 ? Effect.never : Effect.void),
    }))
    const first = r.mutate(0)
    if (how === 'switch') {
      await tick()
      await r.mutate(1)
      expect(Exit.isInterrupted(await first)).toBe(true)
      expect(client.getData(q('1'))).toEqual(Option.some('base+1'))
    } else {
      expect(Exit.isFailure(await first)).toBe(true)
      expect(client.getData(q('1'))).toEqual(Option.some('base'))
    }
  })

  it.each([
    ['switch', 1, ['interrupted', 'ok']],
    ['queue', 1, ['ok', 'ok']],
    ['parallel', 2, ['ok', 'ok']],
  ] as const)('%s concurrency', async (concurrency, maxRunning, outcomes) => {
    const store = makeAtomStore()
    let running = 0
    let peak = 0
    const m = Mutation.make({
      concurrency,
      run: (_: number) => Effect.acquireUseRelease(
        Effect.sync(() => { peak = Math.max(peak, ++running) }),
        () => Effect.sleep('5 millis'),
        () => Effect.sync(() => { running-- }),
      ),
    })
    const r = Mutation.runner(store, m)
    const exits = await Promise.all([r.mutate(1), r.mutate(2)])
    expect(peak).toBe(maxRunning)
    expect(exits.map((e) => (Exit.isSuccess(e) ? 'ok' : 'interrupted'))).toEqual(outcomes)
    expect(store.get(r.state)._tag).toBe('success')
  })

  it('cancel precedes onMutate; onMutate failure never calls run', async () => {
    const store = makeAtomStore()
    const log: string[] = []
    const q = Query.make({ key: () => ['k'], fetch: (): Effect.Effect<string> => Effect.never })
    const release = Query.observe(store, q(undefined))
    const m = Mutation.make({
      cancel: () => { log.push('cancel'); return q(undefined) },
      onMutate: () => Effect.zipRight(Effect.sync(() => {
        log.push(`onMutate waiting=${store.get(q(undefined)).waiting}`)
      }), Effect.fail('nope')),
      run: () => Effect.sync(() => { log.push('run') }),
    })
    const exit = await Mutation.runner(store, m).mutate(undefined)
    expect(Exit.isFailure(exit)).toBe(true)
    expect(log).toEqual(['cancel', 'onMutate waiting=false'])
    release()
  })

  it('release does not interrupt unless interruptOnUnmount; store disposal interrupts', async () => {
    const run = (flag: boolean) => {
      const store = makeAtomStore()
      const r = Mutation.runner(store, Mutation.make({ run: () => Effect.sleep('20 millis'), interruptOnUnmount: flag }))
      return { store, r, p: r.mutate(undefined) }
    }
    const kept = run(false)
    kept.r.release()
    expect(Exit.isSuccess(await kept.p)).toBe(true)
    const cut = run(true)
    cut.r.release()
    expect(Exit.isInterrupted(await cut.p)).toBe(true)
    const disposed = run(false)
    await disposed.store.dispose()
    expect(Exit.isInterrupted(await disposed.p)).toBe(true)
  })

  it('runs with the store context and a shared definition shares one state', async () => {
    class Api extends Context.Tag('Api')<Api, { readonly n: number }>() {}
    const store = makeAtomStore({ context: Context.make(Api, { n: 7 }) })
    const m = Mutation.shared(Mutation.make({ run: () => Effect.map(Api, (a) => a.n) }))
    const a = Mutation.runner(store, m)
    expect(Mutation.runner(store, m)).toBe(a)
    const exit = await a.mutate(undefined)
    expect(exit).toEqual(Exit.succeed(7))
  })
})
