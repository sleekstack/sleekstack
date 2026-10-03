import { Context, Effect, Layer } from 'effect'
import { defineHandler, el, on, resume, Store } from '@sleekstack/ui'

class Repo extends Context.Tag('Repo')<Repo, string>() {}
const RepoLive = Layer.succeed(Repo, 'r')

export const save = defineHandler('save', () => Effect.asVoid(Repo))
export const touch = defineHandler('touch', () => Effect.asVoid(Store))

export const view = on(el('button'), { click: save, input: touch })

export const run = (container: Element) =>
  resume({ container, layer: RepoLive, atoms: {}, handlers: { save: () => Promise.resolve({ default: save }), touch: () => Promise.resolve({ default: touch }) } })
