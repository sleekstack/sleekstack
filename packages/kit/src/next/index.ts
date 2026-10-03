// @sleekstack/kit/next: dependency-array actions/queries and the runtime config.
export {
  defineEffect, runOperation, defineQuery, query, fail,
  type ActionResult, type OperationOptions,
} from './action'
export { configureRuntime, type RuntimeConfig } from './runtime'
/** @deprecated Renamed to {@link runOperation} (ADR 0019); `effect` from `@sleekstack/kit` is the side-effect Layer. Removed in the next release. */
export { runOperation as effect } from './action'
