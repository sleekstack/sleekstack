/**
 * `@sleekstack/ui/internal`: renderer hooks for integration packages (such as `@sleekstack/query/ui`) that bind an outside
 * library to components. Not for applications; it may change without notice.
 */
export { Collector, RenderScope } from './reactive'
/** True when no renderer work (re-runs, effect and handler fibers, Pending content) is in flight; `flush` waits for it. */
export { idle } from './reactive'
/**
 * Slot hooks defined outside `ui`, built like `ui`'s own: read `Store` (else fail with `missingStore(name)`), return a
 * slot-free value when `Collector` or `Frame` is unset (outside a component), else `takeSlot(frame)`: fail with its
 * `SlotMismatch`, or push the slot's atom on its first run. A run that writes an atom it reads wraps the write in `writeOwn`.
 */
export { Frame, missingStore, takeSlot, writeOwn } from './reactive'
export type { RunFrame, Slots } from './reactive'
