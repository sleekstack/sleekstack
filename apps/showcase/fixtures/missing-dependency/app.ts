// MissingDependency: UserCard needs UserRepo, and the mount layer provides nothing.
import { Context, Effect, Layer } from 'effect'
import { el, mount } from '@sleekstack/ui'

class UserRepo extends Context.Tag('UserRepo')<UserRepo, { name: string }>() {}

const UserCard = () => Effect.map(UserRepo, (u) => el('h2', {}, u.name))

export const run = (container: Element) => mount(UserCard(), { layer: Layer.empty, container }) // @error MissingDependency
