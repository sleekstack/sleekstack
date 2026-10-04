import { Context, Effect, Layer } from 'effect'
import { Boundary, Provider } from '@sleekstack/ui/jsx-runtime'
import { mount } from '@sleekstack/ui'

class Log extends Context.Tag('Log')<Log, { readonly line: (s: string) => Effect.Effect<void> }>() {}
class Boom {
  readonly _tag = 'Boom'
}

const log = () => Effect.flatMap(Log, (l) => l.line('click'))
const boom = () => Effect.fail(new Boom())
declare const opaque: any

const Needs = () => <button onClick={log}>a</button> // @error MissingDependency
const Fails = () => <button onClick={() => boom()}>b</button> // @error UnhandledError
const Handled = () => <button onClick={() => boom().pipe(Effect.catchTag('Boom', () => Effect.void))}>c</button>
const Opaque = () => <button onClick={opaque}>d</button> // @error Unresolved

const App = () => (
  <main>
    <Needs />
    <Provider layer={Layer.succeed(Log, { line: () => Effect.void })}>
      <button onClick={log}>e</button>
    </Provider>
    <Fails />
    <Boundary tag="Boom" fallback={() => <p>x</p>}>
      <button
        onClick={boom} // @error UnhandledError
      >f</button>
    </Boundary>
    <Handled />
    <Opaque />
  </main>
)

export const run = (c: Element) => mount(<App />, { layer: Layer.empty, container: c })
