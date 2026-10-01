/**
 * packages/next/src/index.ts
 *
 * @sleekstack/next public barrel: the Next.js adapter's Effect runtime.
 */

export {
  configureRuntime,
  getRuntime,
  isNextControlFlow,
  reportFinalizerFailure,
  runEffect,
  RuntimeNotConfigured,
  type ErrorInfo,
  type ErrorSink,
  type RunEffectOptions,
  type RuntimeConfig,
} from './runtime'
