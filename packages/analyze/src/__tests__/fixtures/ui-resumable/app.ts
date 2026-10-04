import { Context, Effect, Layer } from 'effect'
import { defineHandler, el, fromReact, on, resume } from '@sleekstack/ui'

class Repo extends Context.Tag('Repo')<Repo, string>() {}
class Db extends Context.Tag('Db')<Db, string>() {}
const RepoLive = Layer.succeed(Repo, 'r')

const ok = defineHandler('ok', () => Effect.asVoid(Repo))
const needsDb = defineHandler('db', () => Effect.asVoid(Db))
const id = 'computed'
const computed = defineHandler(id, () => Effect.void)
let mutable = ok

export const inline = on(el('a'), { click: defineHandler('x', () => Effect.void) }) // @error NonResumableHandler
export const literalFn = on(el('a'), { click: ok, input: computed }) // @error NonResumableHandler
export const viaLet = on(el('a'), { click: mutable }) // @error NonResumableHandler
export const looped = [1, 2].map((i) => {
  const h = defineHandler(`h${i}`, () => Effect.void)
  return on(el('a'), { click: h }) // @error NonResumableHandler
})

// Yields inside Effect.all and nested guest props are still scanned.
const Row = () => Effect.succeed(on(el('li'), { click: defineHandler('r', () => Effect.void) })) // @error NonResumableHandler
export const List = () => Effect.gen(function* () {
  const rows = yield* Effect.all([Row(), Row()])
  return el('ul', {}, ...rows)
})
const Guest = fromReact((_: { slot: { inner: unknown } }) => null)
export const G = Guest({ slot: { inner: on(el('b'), { click: defineHandler('g', () => Effect.void) }) } }) // @error NonResumableHandler

export const run = (container: Element) =>
  resume({
    container,
    layer: RepoLive,
    atoms: [],
    handlers: {
      ok: () => Promise.resolve({ default: ok }),
      db: () => Promise.resolve({ default: needsDb }), // @error MissingDependency
      bad: () => Promise.resolve({ default: null as any }), // @error NonResumableHandler
    },
  })
