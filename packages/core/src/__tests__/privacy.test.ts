import { describe, expect, it } from 'vitest'
import { Cause, Context, Effect, Exit } from 'effect'
import { makeAppScope, module, privateDependencyOf, service } from '../index'

class Db extends Context.Tag('Db')<Db, { n: number }>() {}
class Repo extends Context.Tag('Repo')<Repo, { n: number }>() {}
class Out extends Context.Tag('Out')<Out, { n: number }>() {}
class Rq extends Context.Tag('Rq')<Rq, { n: number }>() {}

const db = service(Db, {}, () => Effect.succeed({ n: 1 }))
const repo = service(Repo, { requires: [Db] }, ([d]) => Effect.succeed({ n: d.n + 1 }))
const Data = module({ name: 'Data', entries: [db, repo], exports: [Repo] })
const out = service(Out, { requires: [Db] }, ([d]) => Effect.succeed(d))
const run = <T>(e: Effect.Effect<T, unknown>) => Effect.runPromise(e)
const fails = async (e: Effect.Effect<unknown, unknown>) => {
  const exit = await Effect.runPromiseExit(e)
  return Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
}

describe('module privacy', () => {
  it('same-module requires work; omitted exports = all public; outside shadowing allowed', async () => {
    const app = await run(makeAppScope([Data]))
    expect(Context.get(app.context, Repo).n).toBe(2)
    expect(Context.getOption(app.context, Db)._tag).toBe('None')
    expect(privateDependencyOf(app.context, 'Db', 'x')?._tag).toBe('PrivateDependency')
    const open = module({ name: 'Open', entries: [db] })
    expect(Context.get((await run(makeAppScope([open, out]))).context, Out).n).toBe(1)
    const shadow = service(Db, {}, () => Effect.succeed({ n: 9 }))
    const s = await run(makeAppScope([Data, shadow, out]))
    expect(Context.get(s.context, Out).n).toBe(9)
  })

  it('child scopes: outside entries cannot require a private Tag; same-module request nodes can; shadowing allowed', async () => {
    const rq = service(Rq, { requires: [Db], lifetime: 'request' }, ([d]) => Effect.succeed(d))
    const app = await run(makeAppScope([module({ name: 'Data', entries: [db, repo, rq], exports: [Repo, Rq] })]))
    expect(Context.get((await run(app.child('request'))).context, Rq).n).toBe(1)
    expect(await fails(app.child('request', [out]))).toMatchObject({ _tag: 'PrivateDependency', module: 'Data' })
    const shadow = service(Db, {}, () => Effect.succeed({ n: 5 }))
    const c = await run(app.child('request', [shadow, out]))
    expect(Context.get(c.context, Out).n).toBe(5)
    expect(privateDependencyOf(c.context, 'Db', 'x')).toBeUndefined()
  })
})
