import { Data, Effect, Layer } from 'effect'
import { Catch, el, mount } from '@sleekstack/ui'

class NotFound extends Data.TaggedError('NotFound')<{}> {}
class Denied extends Data.TaggedError('Denied')<{}> {}

const Page = (n: number) => (n > 1 ? Effect.fail(new NotFound()) : n > 0 ? Effect.fail(new Denied()) : Effect.succeed(el('p')))

export const run = (c: Element) =>
  mount(Catch('NotFound', () => el('p', {}, 'missing'), Page(1)), { layer: Layer.empty, container: c }) // @error UnhandledError
export const bare = (c: Element) => mount(Effect.fail(new Denied()) as Effect.Effect<ReturnType<typeof el>, Denied>, { layer: Layer.empty, container: c }) // @error UnhandledError
