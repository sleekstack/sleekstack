import { Context, Effect, Layer } from 'effect'
import { el, mount } from '@sleekstack/ui'

class Repo extends Context.Tag('Repo')<Repo, string>() {}
class Clock extends Context.Tag('Clock')<Clock, number>() {}
const RepoLive = Layer.succeed(Repo, 'r')
const View = () => Effect.map(Clock, (n) => el('p', {}, String(n)))

export const run = (c: Element) => mount(View(), { layer: RepoLive, container: c })
