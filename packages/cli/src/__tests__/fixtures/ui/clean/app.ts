import { Context, Effect, Layer } from 'effect'
import { el, mount } from '@sleekstack/ui'

class Repo extends Context.Tag('Repo')<Repo, string>() {}
const RepoLive = Layer.succeed(Repo, 'r')
const View = () => Effect.map(Repo, (r) => el('p', {}, r))

export const run = (c: Element) => mount(View(), { layer: RepoLive, container: c })
