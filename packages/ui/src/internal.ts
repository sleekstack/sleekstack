/**
 * `@sleekstack/ui/internal`: renderer hooks for integration packages (such as `@sleekstack/query/ui`) that bind an outside
 * library to components. Not for applications; it may change without notice.
 */
export { Collector, RenderScope } from './reactive'
/** True when no renderer work (re-runs, effect and handler fibers, Pending content) is in flight; `flush` waits for it. */
export { idle } from './reactive'
