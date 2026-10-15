/** @jsxImportSource @sleekstack/ui */
import { Portal, useLocal } from '@sleekstack/ui'
import { Viewer } from '../modules/identity'

/** Rendered into `document.body`, yet it reads the `Viewer` that its position in the tree provides. */
const Dialog = function* ({ onClose }: { onClose: () => void }) {
  const { user } = yield* Viewer
  return (
    <div className="dialog" role="dialog" aria-label="Portal dialog">
      <p>Opened by {user.name}. This dialog is in document.body, outside the view that opened it.</p>
      <button type="button" className="close" onClick={onClose}>
        Close
      </button>
    </div>
  )
}

/** The dialog opens only on a click, so the server renders no portal (it would emit nothing anyway). */
export const PortalDemo = function* () {
  const [open, setOpen] = yield* useLocal(false)
  return (
    <section className="demo portal">
      <h2>Portal</h2>
      <button type="button" className="open-dialog" onClick={() => setOpen(true)}>
        Open the dialog
      </button>
      {open && (
        <Portal container={document.body}>
          <Dialog onClose={() => setOpen(false)} />
        </Portal>
      )}
    </section>
  )
}
