export type Trigger = 'load' | 'visible'

/** Arms `trigger` on `el`; calls `fire` at most once. Returns a disarm function. */
export const arm = (el: Element, trigger: Trigger, fire: () => void): (() => void) => {
  if (trigger === 'visible' && typeof IntersectionObserver !== 'undefined') {
    // Keeps observing through non-intersecting entries, so a hidden container
    // (display:none) re-arms and fires once it is shown and scrolled into view.
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        fire()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }
  // `load`, and `visible` without IntersectionObserver.
  let live = true
  queueMicrotask(() => live && fire())
  return () => {
    live = false
  }
}
