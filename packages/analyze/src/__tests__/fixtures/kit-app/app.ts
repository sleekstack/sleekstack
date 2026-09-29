import { atom, effect, layer, module, tag } from '@sleekstack/kit'
import * as T from './tags'

export abstract class Mailer { abstract send(to: string): void }

const infraProvide = [layer(T.Clock, { now: () => 0 }), layer(T.Logger, (clock) => ({ log: () => clock.now() }), [T.Clock])]

export const Infra = module({ name: 'Infra', provide: [...infraProvide, layer(T.Store, {}, [], { lifetime: 'app' })], exports: [T.Clock, T.Logger] })

function makeData() {
  return [layer(T.Repos.Task, (l) => ({ l }), [T.Logger], { lifetime: 'request' })]
}
const dataProvide = makeData()
dataProvide.push(layer(Mailer, { send: () => {} }))

export const Data = module({
  name: 'Data',
  imports: [Infra],
  provide: dataProvide,
})

export const App = module({
  name: 'App',
  imports: () => [Data, Infra],
  provide: [layer(T.Clock, { now: () => 1 }), effect(() => {}, [T.Logger, T.Repos.Task], { name: 'boot', lifetime: 'request' })],
})

export const count = atom((clock, get) => clock.now(), [T.Clock])

const derive = (clock: { now(): number }) => clock.now() * 2
export const doubled = atom(derive, [T.Clock])
