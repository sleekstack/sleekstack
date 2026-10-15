// EffectInsideReact: an Effect component rendered under a React guest.
import { Effect, Layer } from 'effect'
import { el, fromReact, mount } from '@sleekstack/ui'

const Badge = () => Effect.succeed(el('span', {}, 'badge'))

const Shell = fromReact(() => <div><Badge /></div>) // @error EffectInsideReact

export const run = (container: Element) => mount(Shell({}), { layer: Layer.empty, container })
