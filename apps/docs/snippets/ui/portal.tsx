/** @jsxImportSource @sleekstack/ui */
import { Context } from 'effect'
import { Portal, useLocal } from '@sleekstack/ui'

class Viewer extends Context.Tag('Viewer')<Viewer, { readonly user: string }>() {}

// Rendered into document.body, yet it reads the Viewer that its position in the tree provides.
const Dialog = function* ({ onClose }: { onClose: () => void }) {
  const { user } = yield* Viewer
  return (
    <div role="dialog" aria-label="Details">
      <p>Opened by {user}</p>
      <button onClick={onClose}>Close</button>
    </div>
  )
}

export const Details = function* () {
  const [open, setOpen] = yield* useLocal(false)
  return (
    <section>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Portal container={document.body}>
          <Dialog onClose={() => setOpen(false)} />
        </Portal>
      )}
    </section>
  )
}
