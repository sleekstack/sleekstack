// @sleekstack/kit/next: dependency-array actions/queries and the runtime config.
export {
  defineEffect, effect, defineQuery, query, fail,
  type ActionResult, type OperationOptions,
} from './action'
export { configureRuntime, type RuntimeConfig } from './runtime'
export { prefetch, type PrefetchOptions } from './prefetch'
