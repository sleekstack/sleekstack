// Targets whose native click default already ran before hydration and would run again.
const NATIVE = 'a[href], area[href], input[type=checkbox i], input[type=radio i], label, summary'

const isSubmit = (el: Element) => {
  const b = el.closest('button, input[type=submit i], input[type=image i]')
  return b !== null && (b as HTMLButtonElement).type !== 'button' && (b as HTMLButtonElement).type !== 'reset' && (b as HTMLButtonElement).form !== null
}

/** Whether a click recorded before hydration should be re-dispatched on its target. */
export const shouldReplay = (container: Element, target: EventTarget | null): target is Element => {
  if (!(target instanceof Element) || !target.isConnected || !container.contains(target)) return false
  const native = target.closest(NATIVE)
  if (native !== null && container.contains(native)) return false
  return !isSubmit(target)
}

/** Re-dispatches a clone of `click` on its original target; drops it silently when not replayable. */
export const replayClick = (container: Element, click: Event) => {
  const t = click.target
  if (!shouldReplay(container, t)) return
  const m = click as MouseEvent
  t.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: m.detail,
      clientX: m.clientX,
      clientY: m.clientY,
      screenX: m.screenX,
      screenY: m.screenY,
      button: m.button,
      buttons: m.buttons,
      ctrlKey: m.ctrlKey,
      shiftKey: m.shiftKey,
      altKey: m.altKey,
      metaKey: m.metaKey,
    }),
  )
}
