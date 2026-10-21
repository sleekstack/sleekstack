/** @jsxImportSource @sleekstack/ui */
import { mount, useAction, useAtomValue, type ActionEvent } from '@sleekstack/ui'
import { Cause, Effect, Option } from 'effect'
import ServerServicesLive from 'virtual:sleek/server'
import { Profiles } from './profiles'

/** The page asks for `Profiles`; whether the call runs in-process or over the wire is the layer's business. */
const Rename = function* () {
  const [result, submit] = yield* useAction(function* (event: ActionEvent) {
    const profiles = yield* Profiles
    return yield* profiles.rename({ name: String(event.formData.get('name')) })
  })
  const outcome = yield* useAtomValue(result)
  const error = outcome._tag === 'Failure' ? Option.getOrUndefined(Cause.failureOption(outcome.cause)) : undefined
  return (
    <form action={submit}>
      <input name="name" />
      <button type="submit">Rename</button>
      {error?._tag === 'NameTaken' && <p>{error.name} is taken</p>}
      {outcome._tag === 'Success' && <p>Now {outcome.value.name}</p>}
    </form>
  )
}

// The browser: every Server Service Tag as a client over the wire.
export const main = Effect.promise(() =>
  mount(<Rename />, { layer: ServerServicesLive, container: document.getElementById('app')! }),
)
