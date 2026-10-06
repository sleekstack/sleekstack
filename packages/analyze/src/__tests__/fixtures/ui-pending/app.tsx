import { Context, Effect, Layer } from 'effect'
import { Pending } from '@sleekstack/ui/jsx-runtime'
import { el, mount } from '@sleekstack/ui'

class Log extends Context.Tag('Log')<Log, { readonly line: (s: string) => Effect.Effect<void> }>() {}
class Boom {
  readonly _tag = 'Boom'
}

const Needs = () => Effect.as(Log, el('p', {}, 'a'))
const Fails = () => Effect.as(Effect.fail(new Boom()), el('p', {}, 'b'))

const App = () => (
  <Pending
    fallback={<Fails />} // @error UnhandledError
  >
    <Needs // @error MissingDependency
    />
  </Pending>
)

export const run = (c: Element) => mount(<App />, { layer: Layer.empty, container: c })
