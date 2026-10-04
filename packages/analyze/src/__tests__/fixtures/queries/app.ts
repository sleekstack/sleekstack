import { Context, Effect } from 'effect'
import { cachedQuery, layer, mutation, tag } from '@sleekstack/kit'
import { configureRuntime } from '@sleekstack/kit/next'

const A = tag<string>('A')
const Nowhere = tag<string>('Nowhere')
class Api extends Context.Tag('Api')<Api, { get(id: string): Effect.Effect<string> }>() {}
class Gone extends Context.Tag('Gone')<Gone, string>() {}
const loose: any = (id: string) => Effect.succeed(id)
const dyn = (id: string) => ['todo', id]
let prefix = 'todo'
const Svc = Context.GenericTag<{ readonly svc: true }, string>('Svc')

configureRuntime({ provide: [layer(A, 'a'), layer(Api, { get: (id: string) => Effect.succeed(id) })] })

export const ok = cachedQuery({ key: (id: string) => ['todo', id, 1, true] as const, fetch: function* (id) { return (yield* A) + id } })
export const okCore = cachedQuery({ key: (id: string) => ['todo', id], fetch: function* (id) { return yield* Effect.flatMap(Api, (api) => api.get(id)) } })
export const okRun = mutation({ run: function* (input: string) { return (yield* A) + input } })

export const missing = cachedQuery({ key: (id: string) => ['todo', id], fetch: function* () { return yield* Nowhere } }) // @error MissingDependency
export const missingCore = cachedQuery({ key: (id: string) => ['gone', id], fetch: function* () { return yield* Gone } }) // @error MissingDependency
export const missingRun = mutation({ run: function* () { return yield* Nowhere } }) // @error MissingDependency
export const missingCoreRun = mutation({ run: function* () { return yield* Gone } }) // @error MissingDependency

export const named = cachedQuery({ key: (id: string) => [...dyn(id)], fetch: function* () { return yield* A } }) // @error Computed
export const notTuple = cachedQuery({ key: (id: string) => id.split('/'), fetch: function* () { return yield* A } }) // @error Computed
export const nonLiteral = cachedQuery({ key: (id: string) => [prefix, id], fetch: function* () { return yield* A } }) // @error Computed
export const anyParam = cachedQuery({ key: (id: any) => ['todo', id], fetch: function* () { return yield* A } }) // @error Computed
export const anyFetch = cachedQuery({ key: (id: string) => ['x', id], fetch: loose }) // @error Computed
export const okMethod = cachedQuery({ key(id: string, flag?: boolean) { return ['m', id] }, *fetch(id) { return yield* Effect.map(Api, () => id) } })
export const okBool = cachedQuery({ key: (b: boolean) => ['b', b], *fetch() { return yield* A } })
export const literalUnion = cachedQuery({ key: (s: 'open' | 'closed') => ['s', s], *fetch() { return yield* A } }) // @error Computed
export const missingTag = cachedQuery({ key: (id: string) => ['t', id], *fetch() { return yield* Gone } }) // @error MissingDependency
export const missingGeneric = cachedQuery({ key: (id: string) => ['g', id], *fetch() { return yield* Svc } }) // @error MissingDependency
export const missingGenericRun = mutation({ *run() { return yield* Svc } }) // @error MissingDependency
export const unknownParam = cachedQuery({ key: (id: unknown) => ['u', id], fetch: function* () { return yield* A } }) // @error Computed
export const unionParam = cachedQuery({ key: (id: string | (() => void)) => ['u', id], fetch: function* () { return yield* A } }) // @error Computed
