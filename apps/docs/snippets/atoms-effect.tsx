/** @jsxImportSource @sleekstack/ui */
import { Context, Effect, Layer } from 'effect'
import { Atom, Result } from '@sleekstack/core'
import { mount, useAtom, useAtomValue } from '@sleekstack/ui'

class Api extends Context.Tag('Api')<Api, { user(id: number): Effect.Effect<string> }>() {}
const ApiLive = Layer.succeed(Api, { user: (id: number) => Effect.succeed(`user ${id}`) })

const userId = Atom.make(1)
// An Effect atom: `Api` resolves from the mount's layer; its value is a Result.
const userName = Atom.make((get) => Effect.flatMap(Api, (api) => api.user(get(userId))))

const User = function* () {
  const [id, setId] = yield* useAtom(userId)
  const name = Result.match(yield* useAtomValue(userName), {
    onInitial: () => 'Loading',
    onSuccess: (r) => r.value,
    onFailure: () => 'Failed',
  })
  return (
    <p>
      {name}
      <button type="button" onClick={() => setId(id + 1)}>
        next
      </button>
    </p>
  )
}

export const start = (container: Element) => mount(<User />, { layer: ApiLive, container })
