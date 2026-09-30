/**
 * packages/next/src/index.ts
 *
 * @sleekstack/next public barrel: the Next.js adapter's Effect runtime (plus action/query until kit moves off them).
 */

export {
  configureRuntime,
  getRuntime,
  runEffect,
  RuntimeNotConfigured,
  type LayerRuntimeConfig,
  type ProvideRuntimeConfig,
  type RunEffectOptions,
  type RuntimeConfig,
} from './runtime'
export { action, query, type Operation, type OperationOptions } from './action'
