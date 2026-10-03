/** @jsxImportSource @sleekstack/ui */
import { Effect, Layer } from 'effect'
import { mount, Provider } from '@sleekstack/ui'

class Clock extends Effect.Tag('Clock')<Clock, { now(): number }>() {}

const Now = () => Effect.gen(function* () {
  const now = yield* Clock.now()
  return yield* <time>{now}</time>
})

const orphan = <Now /> // @error MissingDependency

// Clock is provided under <Provider>, but not for `orphan`.
export const run = (container: Element) =>
  mount(
    <main>
      <Provider layer={Layer.succeed(Clock, { now: () => 0 })}>
        <Now />
      </Provider>
      {orphan}
    </main>,
    { layer: Layer.empty, container },
  )
