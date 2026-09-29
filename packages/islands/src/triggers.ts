export type Trigger = 'load' | 'idle' | 'visible' | 'interaction'

export type ArmOptions = { readonly rootMargin?: string }

/** Idle trigger fires by this deadline even on a busy main thread. */
const IDLE_TIMEOUT = 2000
const INTERACTION_EVENTS = ['pointerdown', 'touchstart', 'focusin', 'keydown', 'click'] as const

/**
 * Arms `trigger` on `el`. Returns a disarm function.
 * `load`, `idle` and `visible` call `fire` at most once; `interaction` calls it
 * with every captured event until disarmed, so the caller can keep the first click.
 */
export const arm = (el: Element, trigger: Trigger, fire: (e?: Event) => void, opts: ArmOptions = {}): (() => void) => {
  if (trigger === 'interaction') {
    const on = (e: Event) => fire(e)
    for (const t of INTERACTION_EVENTS) el.addEventListener(t, on, { capture: true, passive: true })
    return () => {
      for (const t of INTERACTION_EVENTS) el.removeEventListener(t, on, { capture: true })
    }
  }
  if (trigger === 'idle') {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(() => fire(), { timeout: IDLE_TIMEOUT })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(() => fire(), 1)
    return () => clearTimeout(id)
  }
  if (trigger === 'visible' && typeof IntersectionObserver !== 'undefined') {
    // Keeps observing through non-intersecting entries, so a hidden container
    // (display:none) re-arms and fires once it is shown and scrolled into view.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          fire()
        }
      },
      opts.rootMargin === undefined ? undefined : { rootMargin: opts.rootMargin },
    )
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
