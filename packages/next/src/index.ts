/**
 * packages/next/src/index.ts
 *
 * @sleekstack/next public barrel: the Next.js adapter's Effect runtime.
 */

export {
  configureRuntime,
  getRuntime,
  isNextControlFlow,
  runEffect,
  RuntimeNotConfigured,
  type LayerRuntimeConfig,
  type ProvideRuntimeConfig,
  type RunEffectOptions,
  type RuntimeConfig,
} from './runtime'
