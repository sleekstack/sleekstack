import { Context, Data, Effect, Layer } from 'effect'
import { Boundary, mount, Provider, useLocal } from '@sleekstack/ui'

class Repo extends Context.Tag('Repo')<Repo, string>() {}
class Clock extends Context.Tag('Clock')<Clock, number>() {}
class Boom extends Data.TaggedError('Boom')<{}> {}

// A `function*` component: `yield*` reads its services, it returns the element.
const Name = function* () {
  const repo = yield* Repo
  return <b>{repo}</b>
}
const Time = function* () {
  const n = yield* Clock
  return <i>{n}</i>
}
const Risky = function* () {
  yield* Effect.fail(new Boom())
  return <p />
}
const Local = function* () {
  const [n] = yield* useLocal(0)
  return <u>{n}</u>
}
const BadLocal = function* (flag: boolean) {
  if (flag) yield* useLocal(1) // @error ConditionalSlot
  return <u />
}
// An Effect component mixing in: its child generator's needs still reach the mount.
const Mixed = () => Effect.gen(function* () {
  return yield* (
    <section>
      <Name />
    </section>
  )
})

export const ok = (c: Element) =>
  mount(
    <Provider layer={Layer.succeed(Repo, 'r')}>
      <Name />
      <Local />
      <Mixed />
      <Boundary tag="Boom" fallback={() => <p>caught</p>}>
        <Risky />
      </Boundary>
    </Provider>,
    { layer: Layer.empty, container: c },
  )
export const missing = (c: Element) => mount(<Time />, { layer: Layer.succeed(Repo, 'r'), container: c }) // @error MissingDependency
export const unhandled = (c: Element) => mount(<Risky />, { layer: Layer.empty, container: c }) // @error UnhandledError
void BadLocal
