import { describe, expect, it } from 'vitest'
import { Cause, Context, Effect, Option } from 'effect'
import { Atom, atomStoreFor, makeAppScope, module, Result, service } from '../index'

class Db extends Context.Tag('Db')<Db, number>() {}
class Pub extends Context.Tag('Pub')<Pub, number>() {}
class Nope extends Context.Tag('Nope')<Nope, number>() {}

const Data = module({
  name: 'Data',
  entries: [service(Db, {}, () => Effect.succeed(1)), service(Pub, {}, () => Effect.succeed(2))],
  exports: [Pub],
})
const tick = () => new Promise<void>((r) => setTimeout(r, 0))
const failureOf = (r: Result.Result<unknown, unknown>) => (Result.isFailure(r) ? Option.getOrUndefined(Cause.failureOption(r.cause)) : undefined)

describe('atomStoreFor', () => {
  it('pins Effect\'s "Service not found" defect message', () => {
    const exit = Effect.runSyncExit(Nope as unknown as Effect.Effect<number>)
    expect(exit._tag === 'Failure' && (Cause.squash(exit.cause) as Error).message).toMatch(/^Service not found: Nope( \(defined at .*\))?$/s)
  })

  it('resolves public and shadowed Tags; missing/private give typed failures', async () => {
    const app = await Effect.runPromise(makeAppScope([Data]))
    const child = await Effect.runPromise(app.child('component', [service(Pub, { lifetime: 'component' }, () => Effect.succeed(20))]))
    const read = (tag: Context.Tag<any, number>) => Atom.make(Effect.gen(function* () { return yield* tag }))
    const store = atomStoreFor(app)
    const shadowStore = atomStoreFor(child)
    expect(store.get(read(Pub))).toMatchObject({ _tag: 'Success', value: 2 })
    expect(shadowStore.get(read(Pub))).toMatchObject({ _tag: 'Success', value: 20 })
    const missing = read(Nope)
    expect(failureOf(store.get(missing))).toMatchObject({
      _tag: 'MissingDependency', service: missing.label, missing: 'Nope',
    })
    const hidden = read(Db)
    expect(failureOf(store.get(hidden))).toMatchObject({
      _tag: 'PrivateDependency', tag: 'Db', module: 'Data', requiredBy: hidden.label,
    })
  })

  it('keeps the rest of a compound Cause; an empty key maps too', async () => {
    const app = await Effect.runPromise(makeAppScope([]))
    const store = atomStoreFor(app)
    const r = store.get(Atom.make(Effect.ensuring(Nope, Effect.die('cleanup'))))
    expect(Result.isFailure(r) && [...Cause.failures(r.cause)]).toMatchObject([{ _tag: 'MissingDependency', missing: 'Nope' }])
    expect(Result.isFailure(r) && [...Cause.defects(r.cause)]).toEqual(['cleanup'])
    const empty = Context.GenericTag<number>('')
    expect(failureOf(store.get(Atom.make(Effect.map(empty, (n) => n))))).toMatchObject({ _tag: 'MissingDependency', missing: '' })
  })

  it('closing the scope interrupts keepAlive atoms before service finalizers; store failures go to onFinalizerError', async () => {
    const order: string[] = []
    class Res extends Context.Tag('Res')<Res, number>() {}
    const res = service(Res, {}, () => Effect.acquireRelease(Effect.succeed(1), () => Effect.sync(() => order.push('service'))))
    const app = await Effect.runPromise(makeAppScope([res]))
    const errors: unknown[] = []
    const store = atomStoreFor(app, { onFinalizerError: (e) => errors.push(e) })
    const running = Atom.keepAlive(Atom.make(Effect.onInterrupt(Effect.never, () => Effect.sync(() => order.push('atom')))))
    const failing = Atom.make((get) => { get.addFinalizer(() => { throw new Error('boom') }); return 0 })
    store.get(running)
    store.mount(failing)
    await tick()
    await Effect.runPromise(app.close)
    expect(order).toEqual(['atom', 'service'])
    expect(errors).toEqual([new Error('boom')])
  })
})
