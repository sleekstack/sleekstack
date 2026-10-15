/** @jsxImportSource @sleekstack/ui */
// Event closure: a host onClick that can fail must handle its error; E has to be never.
import { Effect, Layer } from 'effect'
import { mount } from '@sleekstack/ui'

class Boom {
  readonly _tag = 'Boom'
}

export const run = (container: Element) =>
  mount(
    <button
      onClick={() => Effect.fail(new Boom())} // @error UnhandledError
    >
      go
    </button>,
    { layer: Layer.empty, container },
  )
