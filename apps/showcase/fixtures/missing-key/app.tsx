/** @jsxImportSource @sleekstack/ui */
// MissingKey: a mapped list without keys cannot keep its rows' nodes when it reorders.
import { Layer } from 'effect'
import { mount } from '@sleekstack/ui'

const ids = ['a', 'b']

export const run = (container: Element) =>
  mount(
    <ul>
      {ids.map((id) => (
        <li>{id}</li> // @error MissingKey
      ))}
    </ul>,
    { layer: Layer.empty, container },
  )
