import { Layer } from 'effect'
import { resume } from '@sleekstack/ui'
import { countAtom } from './count'

// The client entry imports no component and no handler: each handler loads on its first event.
export const start = (container: Element) =>
  resume({ container, layer: Layer.empty, handlers: { increment: () => import('./increment') }, atoms: [countAtom] })
