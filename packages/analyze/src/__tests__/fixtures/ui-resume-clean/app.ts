import { Context, Effect, Layer } from 'effect'
import { defineHandler, el, on, resume, Store } from '@sleekstack/ui'
import dflt from './handlers'

class Repo extends Context.Tag('Repo')<Repo, string>() {}
const RepoLive = Layer.succeed(Repo, 'r')

export const save = defineHandler('save', () => Effect.asVoid(Repo))
export const touch = defineHandler('touch', () => Effect.asVoid(Store))

export const view = on(el('button'), { click: save, input: touch, change: dflt, dflt })

const handlers = {
  save: () => Promise.resolve({ default: save }),
  touch() { return Promise.resolve({ default: touch }) },
  dflt: () => import('./handlers'),
}
const opts = { layer: RepoLive, atoms: [], handlers }
export const run = (container: Element) => resume({ container, ...opts })
