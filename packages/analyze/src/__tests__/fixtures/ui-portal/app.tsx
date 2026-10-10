import { Context, Effect, Layer } from 'effect'
import { Portal } from '@sleekstack/ui/jsx-runtime'
import { el, mount } from '@sleekstack/ui'

class Log extends Context.Tag('Log')<Log, { readonly line: (s: string) => Effect.Effect<void> }>() {}

const Needs = () => Effect.as(Log, el('p', {}, 'a'))

const App = () => (
  <Portal container={null}>
    <Needs // @error MissingDependency
    />
  </Portal>
)

export const run = (c: Element) => mount(<App />, { layer: Layer.empty, container: c })
