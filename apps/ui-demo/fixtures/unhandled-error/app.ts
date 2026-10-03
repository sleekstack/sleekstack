// UnhandledError: Catch handles UserNotFound, but Denied still reaches mount.
import { Data, Effect, Layer } from 'effect'
import { Catch, el, mount } from '@sleekstack/ui'

class UserNotFound extends Data.TaggedError('UserNotFound')<{}> {}
class Denied extends Data.TaggedError('Denied')<{}> {}

const UserCard = (n: number) => (n > 1 ? Effect.fail(new UserNotFound()) : n > 0 ? Effect.fail(new Denied()) : Effect.succeed(el('p')))

export const run = (container: Element) =>
  mount(Catch('UserNotFound', () => el('p', {}, 'Not found'), UserCard(1)), { layer: Layer.empty, container }) // @error UnhandledError
