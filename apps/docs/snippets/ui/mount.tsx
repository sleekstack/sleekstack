/** @jsxImportSource @sleekstack/ui */
import { Layer } from 'effect'
import { hydrateMount, mount, renderToStream, renderToString } from '@sleekstack/ui'
import { Todos } from './keys'

// Server: the page as one string, or as a stream whose first chunk goes out before `Pending` content resolves.
export const page = () => renderToString(<Todos />, { layer: Layer.empty })
export const pageStream = (nonce: string) => renderToStream(<Todos />, { layer: Layer.empty, nonce })

// Client: adopt the server DOM (each component runs once), or build the DOM from nothing.
export const hydrate = (container: Element) => hydrateMount(<Todos />, { layer: Layer.empty, container })
export const render = (container: Element) =>
  mount(<Todos />, { layer: Layer.empty, container, onError: (cause) => console.error(cause) })
