/**
 * packages/next/src/index.ts
 *
 * @sleekstack/next public barrel: the Next.js preset over `@sleekstack/runtime`.
 */

export {
  configureRuntime,
  getRuntime,
  reportFinalizerFailure,
  RuntimeNotConfigured,
  type ErrorInfo,
  type ErrorSink,
  type RunEffectOptions,
  type RuntimeConfig,
} from '@sleekstack/runtime'
export { isNextControlFlow, runEffect } from './runtime'
export { prefetchQueries } from './query'
export { prefetchAtoms } from './atoms'
